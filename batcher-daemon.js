// batcher-daemon.js
// Lightweight, safe HWGW batcher with auto-scaling and reliability target.
// Not the fanciest JIT, but stable and good from mid-game → late-game.

import { getConfig } from "lib-config.js";

export async function main(ns) {
  ns.disableLog("sleep");
  const cfg = await getConfig(ns);
  const B = cfg.batcher || {};
  const dry = cfg.dryRun || {};

  const delta = B.deltaMs ?? 200;
  const relTarget = B.targetReliability ?? 0.99;
  let hackPct = B.defaultHackPct ?? 0.02;

  // Pick best target by money vs. security
  function pickTarget() {
    const servers = discover(ns).filter(s => s!=="home" && ns.hasRootAccess(s));
    let best = null, bestScore = -1;
    for (const s of servers) {
      const maxM = ns.getServerMaxMoney(s) || 0;
      if (maxM <= 0) continue;
      const sec  = ns.getServerMinSecurityLevel(s) + 5;
      const sc = maxM / sec;
      if (sc > bestScore) { bestScore = sc; best = s; }
    }
    return best;
  }

  const target = pickTarget();
  if (!target) { ns.print("batcher: no valid targets yet"); return; }
  ns.print(`batcher: target=${target}`);

  // Simple loop: prepare → run batches within RAM
  while (true) {
    // prep to near min security and high money
    await prep(ns, target, dry);

    // compute threads for given hackPct using formulas
    const hThreads = Math.max(1, Math.floor(ns.hackAnalyzeThreads(target, (ns.getServerMoneyAvailable(target)||1) * hackPct)));
    const gThreads = Math.ceil(ns.growthAnalyze(target, 1/(1-hackPct)));
    const w1 = Math.ceil(hThreads * 1.75);  // rough compensate sec increase
    const w2 = Math.ceil(gThreads * 0.25);  // rough compensate after grow

    // schedule HWGW with delta spacing; keep concurrency modest
    const batches = Math.max(1, Math.min(B.maxBatchesInFlight ?? 6, 6));
    for (let i = 0; i < batches; i++) {
      // respect available RAM policy
      if (!haveRam(ns, cfg, target, hThreads, gThreads, w1 + w2)) break;

      const t0 = Date.now() + i * delta;
      // order: weaken (for grow) -> grow -> weaken (for hack) -> hack, so they land tidy
      launch(ns, dry, "weaken", target, w1, t0);
      launch(ns, dry, "grow",   target, gThreads, t0 + delta);
      launch(ns, dry, "weaken", target, w2, t0 + 2*delta);
      launch(ns, dry, "hack",   target, hThreads, t0 + 3*delta);
    }

    // crude reliability tuning: if money dropped too far, reduce hackPct; else nudge up
    await ns.sleep(4000);
    const avail = ns.getServerMoneyAvailable(target);
    const maxM  = ns.getServerMaxMoney(target) || 1;
    const ratio = avail / maxM;
    if (ratio < 0.60) hackPct = Math.max(B.minHackPct ?? 0.005, hackPct * 0.8);
    else if (ratio > 0.90) hackPct = Math.min(B.maxHackPct ?? 0.2, hackPct * 1.05);
  }

  // helpers
  function haveRam(ns, cfg, t, ht, gt, wt){
    const homeMax = ns.getServerMaxRam("home"), homeUsed = ns.getServerUsedRam("home");
    const homePct = cfg.ramUsage?.homePercent ?? 0.5;
    const free = Math.max(0, homeMax * homePct - homeUsed);
    const need = ns.getScriptRam("workers-weaken.js","home") * wt
      + ns.getScriptRam("workers-grow.js","home") * gt
      + ns.getScriptRam("workers-hack.js","home") * ht || 1;
    return free + 1e-9 >= need;
  }
  function launch(ns, dry, kind, host, threads, tWhen){
    const delay = Math.max(0, tWhen - Date.now());
    const file = (kind==="hack") ? "workers-hack.js" : (kind==="grow" ? "workers-grow.js" : "workers-weaken.js");
    if (!ns.fileExists(file,"home")) return;
    if (dry.enabled && (dry.noActualHacks || dry.simulateThreadsOnly)) return;
    ns.exec(file, "home", threads, host, delay);
  }
  async function prep(ns, t, dry){
    // basic prep: weaken to near min, then grow to 90%+, then weaken again
    try {
      const min = ns.getServerMinSecurityLevel(t), cur = ns.getServerSecurityLevel(t);
      while (cur - min > 1) {
        if (!dry.enabled) await ns.weaken(t);
        await ns.sleep(50);
        if (ns.getServerSecurityLevel(t) <= min + 1) break;
      }
      while ((ns.getServerMoneyAvailable(t) || 0) < (ns.getServerMaxMoney(t) || 1) * 0.9) {
        if (!dry.enabled) await ns.grow(t);
        await ns.sleep(50);
        if ((ns.getServerMoneyAvailable(t) || 0) >= (ns.getServerMaxMoney(t) || 1) * 0.9) break;
      }
      if (!dry.enabled) await ns.weaken(t);
    } catch {}
  }
  function discover(ns){ const seen=new Set(["home"]),q=["home"]; while(q.length){ const c=q.shift(); for(const n of ns.scan(c)) if(!seen.has(n)){ seen.add(n); q.push(n);} } return [...seen]; }
}
