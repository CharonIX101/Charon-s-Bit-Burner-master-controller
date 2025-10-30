// stock_band_trader.js
/** Cash-aware band trader:
 *  - Scans first (starts paused), then systems-stocks-mgr auto-sends START after scan window.
 *  - Never allocates > walletPctLimit (from config; default 10%) of wallet.
 *  - Keeps reserves and downsizes on-the-fly to avoid "not enough money".
 *  - Logs to console + JS state modules (for master summary).
 */
import { getConfig } from "lib-config.js";

export async function main(ns) {
  ns.disableLog("sleep");

  const cfg = await getConfig(ns);
  const S   = cfg.stocks || {};
  const walletLimitFrac = S.walletPctLimit ?? 0.10;

  const STATE_FILE  = "data-stock_state.js";   // export const stockState  = {SYM:{low,high},...};
  const TRADES_FILE = "data-stock_trades.js";  // export const stockTrades = [ {ts,msg}, ... ];
  const ERR_FILE    = "data-stock_errors.js";  // export const stockErrors = [ {ts,msg}, ... ];

  initModuleIfMissing(TRADES_FILE, "stockTrades", []);
  initModuleIfMissing(ERR_FILE,    "stockErrors", []);
  initModuleIfMissing(STATE_FILE,  "stockState",  {});

  const hasWSE = !!(ns.stock && typeof ns.stock.getSymbols === "function");
  const hasTIX = !!(ns.stock && typeof ns.stock.buyStock === "function" && typeof ns.stock.sellStock === "function");
  if (!hasWSE || !hasTIX) { logErr("Need WSE + TIX APIs"); ns.tprint("ERROR: Need WSE + TIX"); return; }

  const symbols = ns.stock.getSymbols() || [];
  let state = readObj(STATE_FILE) || {};
  for (const sym of symbols) if (!state[sym]) state[sym] = { low: Infinity, high: 0 };
  writeObj(STATE_FILE, state);

  const LOOP_MS = 3000;
  let tradingEnabled = false; // start paused; manager sends START later

  ns.tprint(`stock_band_trader: tradingEnabled=${tradingEnabled}. Waiting for START via port 20/control.`);

  while (true) {
    // control port
    tradingEnabled = processControl(tradingEnabled);

    // update highs/lows
    for (const sym of symbols) {
      const p = ns.stock.getPrice(sym);
      if (!Number.isFinite(p) || p <= 0) continue;
      if (!isFinite(state[sym].low)  || p < state[sym].low)  state[sym].low  = p;
      if (!isFinite(state[sym].high) || p > state[sym].high) state[sym].high = p;
    }
    writeObj(STATE_FILE, state);

    if (!tradingEnabled) { await ns.sleep(LOOP_MS); continue; }

    // signals
    const signals = [];
    for (const sym of symbols) {
      const p = ns.stock.getPrice(sym), lo = state[sym].low, hi = state[sym].high;
      if (!Number.isFinite(p) || hi <= lo) continue;
      const band = 0.30;
      const buyLine  = lo + band*(hi-lo);
      const sellLine = hi - band*(hi-lo);
      const [longShares] = ns.stock.getPosition(sym);
      if (p <= buyLine && longShares === 0) signals.push({sym, side:"BUY"});
      if (p >= sellLine && longShares > 0)  signals.push({sym, side:"SELL", longShares});
    }

    // sells first
    for (const s of signals.filter(x=>x.side==="SELL")) {
      try {
        const filled = ns.stock.sellStock(s.sym, s.longShares);
        if (filled > 0) {
          const gain = ns.stock.getSaleGain(s.sym, filled, "Long");
          logTrade(`SELL ${s.sym} ${filled} | Gain(est): ${fmtMoney(gain)}`);
        }
      } catch (e) { logErr(`SELL ${s.sym} err: ${String(e)}`); }
    }

    // buys with wallet cap
    const buys = signals.filter(x=>x.side==="BUY");
    if (buys.length > 0) {
      const wallet = ns.getServerMoneyAvailable("home");
      const cap = Math.max(0, wallet * walletLimitFrac); // ≤ 10% wallet by default
      let pool = cap;

      for (const s of buys) {
        if (pool <= 0) break;
        const ask = ns.stock.getAskPrice(s.sym);
        const px  = Number.isFinite(ask) && ask>0 ? ask : ns.stock.getPrice(s.sym);
        if (!Number.isFinite(px) || px<=0) continue;

        // per-signal budget (even split)
        const budget = pool / (buys.length);
        let shares = Math.floor(budget / px);
        if (shares <= 0) continue;

        // fit including commission/fees
        shares = fitWithin(ns, s.sym, shares, budget);
        if (shares <= 0) continue;

        try {
          const filled = ns.stock.buyStock(s.sym, shares);
          if (filled > 0) {
            const cost = ns.stock.getPurchaseCost(s.sym, filled, "Long");
            logTrade(`BUY  ${s.sym} ${filled} | Cost(est): ${fmtMoney(cost)}`);
            pool = Math.max(0, pool - cost);
          }
        } catch (e) { logErr(`BUY ${s.sym} err: ${String(e)}`); }
      }
    }

    await ns.sleep(LOOP_MS);
  }

  // helpers
  function fitWithin(ns, sym, shares, budget){
    let sh = shares;
    for (let i=0;i<6;i++){
      const cost = ns.stock.getPurchaseCost(sym, sh, "Long");
      if (cost <= budget) return sh;
      sh = Math.floor(sh*0.85);
      if (sh <= 0) break;
    }
    return 0;
  }

  function processControl(current) {
    const h = ns.getPortHandle(20);
    while (!h.empty()) {
      const msg = String(h.read()).trim().toUpperCase();
      if (msg.startsWith("START")) { logTrade("CONTROL: START"); current = true; }
      else if (msg.startsWith("STOP")) { logTrade("CONTROL: STOP"); current = false; }
      else if (msg.startsWith("RESET")) { writeObj(STATE_FILE, {}); state = {}; logTrade("CONTROL: RESET"); }
    }
    return current;
  }

  function initModuleIfMissing(file, exportName, initVal){
    if (!ns.fileExists(file,"home")) {
      ns.write(file, `export const ${exportName} = ${JSON.stringify(initVal,null,2)};\n`, "w");
    }
  }
  function readObj(file){
    try { const raw=ns.read(file)||""; const A=raw.indexOf("{"),B=raw.lastIndexOf("}"); if (A<0||B<0) return {}; return JSON.parse(raw.slice(A,B+1)); } catch { return {}; }
  }
  function writeObj(file, obj){
    ns.write(file, `export const ${file.includes("state")?"stockState":file.includes("trades")?"stockTrades":"stockErrors"} = ${JSON.stringify(obj,null,2)};\n`, "w");
  }
  function logTrade(msg){ ns.print(msg); appendArr(TRADES_FILE, "stockTrades", {ts:new Date().toISOString(), msg}); }
  function logErr(msg){ ns.print("ERR: "+msg); appendArr(ERR_FILE, "stockErrors", {ts:new Date().toISOString(), msg}); }
  function appendArr(file, exportName, item){
    const arr = readArr(file) || []; arr.push(item);
    ns.write(file, `export const ${exportName} = ${JSON.stringify(arr,null,2)};\n`, "w");
  }
  function readArr(file){
    try { const raw=ns.read(file)||""; const a=raw.indexOf("["),b=raw.lastIndexOf("]"); if (a<0||b<0) return []; return JSON.parse(raw.slice(a,b+1)); } catch { return []; }
  }
  function fmtMoney(x){ if (!isFinite(x)) return `${x}`; if (Math.abs(x)>=1e9) return `$${(x/1e9).toFixed(2)}b`; if (Math.abs(x)>=1e6) return `$${(x/1e6).toFixed(2)}m`; if (Math.abs(x)>=1e3) return `$${(x/1e3).toFixed(2)}k`; return `$${x.toFixed(2)}`; }
}
