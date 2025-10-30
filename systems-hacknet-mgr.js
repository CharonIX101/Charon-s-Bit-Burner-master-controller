// systems-hacknet-mgr.js
import { getConfig } from "lib-config.js";

export async function main(ns) {
  ns.disableLog("sleep");
  const cfg = await getConfig(ns);
  const H = cfg.hacknet || {};
  if (H.autoBuy === false) { ns.print("hacknet: disabled"); return; }

  const budgetFrac = H.budgetFraction ?? 0.05;
  const policy = (H.upgradePolicy || "balanced").toLowerCase();

  while (true) {
    try {
      const wallet = ns.getServerMoneyAvailable("home");
      const budget = wallet * budgetFrac;

      // Buy nodes if affordable
      const buyCost = ns.hacknet.getPurchaseNodeCost();
      if (buyCost <= budget) {
        const idx = ns.hacknet.purchaseNode();
        if (idx >= 0) ns.print(`hacknet: purchased node #${idx} for ${fmtMoney(buyCost)}`);
      }

      // Upgrade existing nodes under budget
      const n = ns.hacknet.numNodes();
      for (let i = 0; i < n; i++) {
        const can = [];
        can.push({type:"level", cost: ns.hacknet.getLevelUpgradeCost(i, 1), fn:()=>ns.hacknet.upgradeLevel(i,1)});
        can.push({type:"ram",   cost: ns.hacknet.getRamUpgradeCost(i, 1),   fn:()=>ns.hacknet.upgradeRam(i,1)});
        can.push({type:"core",  cost: ns.hacknet.getCoreUpgradeCost(i, 1),  fn:()=>ns.hacknet.upgradeCore(i,1)});
        can.sort((a,b)=>a.cost-b.cost);

        let pick = can[0];
        if (policy === "cores-first") pick = can.find(c=>c.type==="core") || pick;
        else if (policy === "ram-first") pick = can.find(c=>c.type==="ram") || pick;
        else if (policy === "levels-first") pick = can.find(c=>c.type==="level") || pick;

        if (pick.cost <= budget && Number.isFinite(pick.cost) && pick.cost > 0) {
          const ok = pick.fn();
          if (ok) ns.print(`hacknet: upgraded ${pick.type} on node ${i} for ${fmtMoney(pick.cost)}`);
        }
      }
    } catch (e) { ns.print("hacknet: error " + String(e)); }

    await ns.sleep(cfg.hacknet?.checkIntervalMs ?? 300000);
  }

  function fmtMoney(x){ if (!isFinite(x)) return `${x}`; if (Math.abs(x)>=1e9) return `$${(x/1e9).toFixed(2)}b`; if (Math.abs(x)>=1e6) return `$${(x/1e6).toFixed(2)}m`; if (Math.abs(x)>=1e3) return `$${(x/1e3).toFixed(2)}k`; return `$${x.toFixed(2)}`; }
}
