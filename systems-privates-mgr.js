// systems-privates-mgr.js
import { getConfig } from "lib-config.js";

export async function main(ns) {
  ns.disableLog("sleep");
  const cfg = await getConfig(ns);
  const P = cfg.privateServers || {};
  const policy = cfg.purchasePolicy || {};
  if (policy.autoBuyPrivate === false) { ns.print("privates: disabled"); return; }

  const namePrefix = P.namePrefix || "GhostFarm";
  const limit = P.totalSlots ?? 25;
  const tiers = P.tiers || [];

  while (true) {
    try {
      const have = ns.getPurchasedServers();
      // Buy up to limit according to tiers
      const plan = expandPlan(tiers, limit);
      for (let i = 0; i < plan.length; i++) {
        const name = `${namePrefix}${i}`;
        const desiredRam = plan[i];
        if (have.includes(name)) {
          const curRam = ns.getServerMaxRam(name);
          if (curRam < desiredRam) await tryUpgrade(ns, name, desiredRam, policy);
        } else {
          if (have.length < limit) await tryBuy(ns, name, desiredRam, policy);
        }
      }
    } catch (e) { ns.print("privates: error " + String(e)); }
    await ns.sleep(60_000);
  }

  function expandPlan(tiers, limit){
    const arr = [];
    for (const t of tiers) for (let i=0;i<t.count;i++) arr.push(t.ramGB);
    return arr.slice(0, limit);
  }

  async function tryBuy(ns, name, ram, policy){
    const maxFrac = policy.privateMaxPriceFractionOfCash ?? 0.9;
    const price = ns.getPurchasedServerCost(ram);
    const wallet = ns.getServerMoneyAvailable("home");
    if (price <= wallet * maxFrac) {
      const ok = ns.purchaseServer(name, ram);
      if (ok) ns.print(`privates: purchased ${name} (${ram}GB) for ${fmtMoney(price)}`);
    }
  }
  async function tryUpgrade(ns, name, ram, policy){
    const maxFrac = policy.privateMaxPriceFractionOfCash ?? 0.9;
    const price = ns.getPurchasedServerUpgradeCost(name, ram);
    const wallet = ns.getServerMoneyAvailable("home");
    if (price <= wallet * maxFrac) {
      const ok = ns.upgradePurchasedServer(name, ram);
      if (ok) ns.print(`privates: upgraded ${name} -> ${ram}GB for ${fmtMoney(price)}`);
    }
  }
  function fmtMoney(x){ if (!isFinite(x)) return `${x}`; if (Math.abs(x)>=1e9) return `$${(x/1e9).toFixed(2)}b`; if (Math.abs(x)>=1e6) return `$${(x/1e6).toFixed(2)}m`; if (Math.abs(x)>=1e3) return `$${(x/1e3).toFixed(2)}k`; return `$${x.toFixed(2)}`; }
}
