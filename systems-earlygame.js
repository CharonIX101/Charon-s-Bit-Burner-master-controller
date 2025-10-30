// systems-earlygame.js
import { getConfig } from "lib-config.js";

export async function main(ns) {
  ns.disableLog("sleep");
  ns.disableLog("scan");

  const cfg = await getConfig(ns);
  const E = cfg.earlyGame || {};
  if (E.enabled === false) { ns.print("earlygame: disabled"); return; }

  const loopMs = E.loopMs ?? 1500;

  ns.print("earlygame: starting HGW engine");

  while (true) {
    if (isBatchReady(ns, cfg)) {
      ns.print("earlygame: batch-ready reached; exiting.");
      return;
    }

    // Basic starter set
    for (const t of ["n00dles","foodnstuff","joesguns","sigma-cosmetics","nectar-net","hong-fang-tea"]) {
      if (!ns.serverExists(t)) continue;
      if (!ns.hasRootAccess(t) && ns.fileExists("RootV3.js","home")) ns.run("RootV3.js", 1, t);

      if (!ns.hasRootAccess(t)) continue;
      const maxM = ns.getServerMaxMoney(t) || 0;
      if (maxM <= 0) continue;

      // Cheap single-thread HGW
      try { await ns.weaken(t); } catch {}
      try { await ns.grow(t); } catch {}
      try { await ns.hack(t); } catch {}
    }

    await ns.sleep(loopMs);
  }

  function isBatchReady(ns, cfg){
    try {
      const lvl = ns.getPlayer().skills.hacking ?? 0;
      const minLvl = cfg.earlyGame?.batchReady?.minHackingLevel ?? 50;
      const rooted = discover(ns).filter(s => s!=="home" && ns.hasRootAccess(s) && (ns.getServerMaxMoney(s)||0)>0);
      const minRooted = cfg.earlyGame?.batchReady?.minRootedTargets ?? 5;
      return (lvl >= minLvl && rooted.length >= minRooted);
    } catch { return false; }
  }
  function discover(ns){ const seen=new Set(["home"]),q=["home"]; while(q.length){ const c=q.shift(); for(const n of ns.scan(c)) if(!seen.has(n)){ seen.add(n); q.push(n);} } return [...seen]; }
}
