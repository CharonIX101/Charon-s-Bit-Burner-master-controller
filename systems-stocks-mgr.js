// systems-stocks-mgr.js
import { getConfig } from "lib-config.js";

export async function main(ns) {
  ns.disableLog("sleep");
  const cfg = await getConfig(ns);
  const S = cfg.stocks || {};
  if (S.enable === false) { ns.print("stocks-mgr: disabled"); return; }

  const hasWSE = !!(ns.stock && typeof ns.stock.getSymbols === "function");
  const hasTIX = !!(ns.stock && typeof ns.stock.buyStock === "function" && typeof ns.stock.sellStock === "function");
  if (!hasWSE || !hasTIX) { ns.print("stocks-mgr: WSE/TIX not available"); return; }

  const trader = S.traderScript || "stock_band_trader.js";
  const control = S.controlScript || "stock_control.js";
  const scanMs = S.autoScanMs ?? 10*60*1000;

  if (!ns.ps().some(p => p.filename === trader)) {
    const pid = ns.run(trader, 1); if (!pid) ns.print("stocks-mgr: failed to launch trader");
  } else ns.print("stocks-mgr: trader already running");

  ns.print(`stocks-mgr: scanning for ${(scanMs/1000)|0}s before auto-start`);
  await ns.sleep(scanMs);

  if (ns.fileExists(control,"home")) {
    ns.run(control, 1, "start");
    ns.print("stocks-mgr: sent START");
  } else {
    try { ns.tryWritePort(20, "START"); ns.print("stocks-mgr: wrote START to port 20"); } catch {}
  }

  while (true) await ns.sleep(60000);
}
