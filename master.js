// master.js
import { getConfig } from "lib-config.js";

export async function main(ns) {
  ns.disableLog("sleep");
  ns.disableLog("getServerMoneyAvailable");
  ns.clearLog();

  const cfg = await getConfig(ns);
  const logCfg = (cfg.logging && cfg.logging.console) ? cfg.logging.console : {};
  const summaryMs = (cfg.logging && cfg.logging.summaryIntervalMs) ? cfg.logging.summaryIntervalMs : 300000;

  const daemons = [
    "systems-rooting.js",
    "systems-privates-mgr.js",
    "systems-earlygame.js",
    "systems-hacknet-mgr.js",
    "systems-batcher.js",
    "systems-stocks-mgr.js"
  ];

  ns.print("master: launching daemons...");
  for (const d of daemons) {
    if (!ns.fileExists(d, "home")) { ns.print(`master: missing ${d}`); continue; }
    if (ns.ps().some(p => p.filename === d)) { ns.print(`master: already running ${d}`); continue; }
    const pid = ns.run(d, 1);
    if (!pid) ns.print(`master: failed to start ${d}`);
    await ns.sleep(50);
  }

  // Rolling summary
  let lastMoney = ns.getServerMoneyAvailable("home");
  let lastTime  = Date.now();
  let lastXp    = getHackXp(ns);

  while (true) {
    await ns.sleep(summaryMs);
    if (logCfg.summaryEnabled === false) continue;

    const now = Date.now();
    const dt  = (now - lastTime) / 1000;

    const curMoney = ns.getServerMoneyAvailable("home");
    const dMoney   = curMoney - lastMoney;
    const mps      = dMoney / dt;
    const mpm      = mps * 60, mph = mpm * 60, mpd = mph * 24;

    const curXp = getHackXp(ns);
    const dXp   = curXp - lastXp;
    const xps   = dXp / dt, xpm = xps * 60, xph = xpm * 60, xpd = xph * 24;

    ns.print("--------------------------------------------------");
    ns.print(`MASTER SUMMARY @ ${new Date().toLocaleString()}`);

    if (logCfg.moneyEnabled !== false) {
      ns.print(`Money Δ ${fmtMoney(dMoney)}  |  ${fmtMoney(mps)}/s  ${fmtMoney(mpm)}/min  ${fmtMoney(mph)}/hr  ${fmtMoney(mpd)}/day`);
    }
    if (logCfg.xpEnabled !== false) {
      ns.print(`Hack XP Δ ${fmtNum(dXp)}  |  ${fmtNum(xps)}/s  ${fmtNum(xpm)}/min  ${fmtNum(xph)}/hr  ${fmtNum(xpd)}/day`);
    }

    if (logCfg.rootingEnabled !== false)   ns.print(readStateSummary(ns, "data-rooting_state.js", "rootingState", "Rooting"));
    if (logCfg.batcherEnabled !== false)   ns.print(readStateSummary(ns, "data-batcher_state.js", "batcherState", "Batcher"));
    if (logCfg.stocksEnabled !== false)    ns.print(readArrayCount(ns, "data-stock_trades.js", "stockTrades", "Stocks trades"));

    if (logCfg.errorsEnabled !== false) {
      const errs = mergeArrays(
        readArray(ns, "data-stock_errors.js", "stockErrors"),
        readArray(ns, "data-batcher_errors.js", "batcherErrors")
      );
      if (errs.length > 0) ns.print(`Errors (last window): ${errs.length} — sample: ${errs.slice(-3).map(e => e.msg || e).join(" | ")}`);
      else ns.print("Errors (last window): 0");
    }
    ns.print("--------------------------------------------------");

    lastMoney = curMoney; lastTime = now; lastXp = curXp;
  }

  // Helpers
  function getHackXp(ns) {
    const p = ns.getPlayer();
    // Bitburner exposes exp via p.exp.hacking in many versions
    return (p?.exp?.hacking ?? 0);
  }
  function fmtMoney(x){
    if (!isFinite(x)) return `${x}`;
    if (Math.abs(x) >= 1e9) return `$${(x/1e9).toFixed(2)}b`;
    if (Math.abs(x) >= 1e6) return `$${(x/1e6).toFixed(2)}m`;
    if (Math.abs(x) >= 1e3) return `$${(x/1e3).toFixed(2)}k`;
    return `$${x.toFixed(2)}`;
  }
  function fmtNum(n){ return isFinite(n) ? Math.floor(n) : `${n}`; }

  function readArray(ns, file, exportName){
    try { if (!ns.fileExists(file,"home")) return []; const raw = ns.read(file)||""; const a=raw.indexOf("["), b=raw.lastIndexOf("]"); if (a<0||b<0) return []; return JSON.parse(raw.slice(a,b+1)); } catch { return []; }
  }
  function readArrayCount(ns, file, exportName, label){
    const arr = readArray(ns, file, exportName);
    return `${label}: ${arr.length}`;
  }
  function readStateSummary(ns, file, exportName, label){
    try {
      if (!ns.fileExists(file,"home")) return `${label}: (no state)`;
      const raw = ns.read(file)||"";
      const A=raw.indexOf("{"), B=raw.lastIndexOf("}");
      if (A<0||B<0) return `${label}: (no state)`;
      const obj = JSON.parse(raw.slice(A,B+1));
      if (obj && obj.summary) return `${label}: ${obj.summary}`;
      return `${label}: ok`;
    } catch { return `${label}: (err)`; }
  }
  function mergeArrays(a,b){ return [...(a||[]), ...(b||[])]; }
}
