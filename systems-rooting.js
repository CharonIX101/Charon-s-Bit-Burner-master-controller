// systems-rooting.js
import { getConfig } from "lib-config.js";

export async function main(ns) {
  ns.disableLog("sleep");
  ns.disableLog("scan");

  const cfg = await getConfig(ns);
  const R = cfg.rooting || {};
  const sweepMs = R.sweepIntervalMs ?? 20*60*1000;
  const stopWhenAll = R.stopWhenAllRooted !== false;
  const buyTools = R.buyToolsFromDarkweb !== false;

  ns.print(`rooting: sweep every ${(sweepMs/60000).toFixed(1)} min, stopWhenAll=${stopWhenAll}, buyTools=${buyTools}`);

  while (true) {
    const all = discoverAll(ns);
    const targets = all.filter(s => s !== "home" && !ns.hasRootAccess(s));
    updateRootingState(ns, { pending: targets.length });

    if (targets.length === 0) {
      ns.print("rooting: all servers rooted.");
      updateRootingState(ns, { summary: "all servers rooted" });
      if (stopWhenAll) return;
      await ns.sleep(sweepMs);
      continue;
    }

    if (buyTools) await tryBuyDarkwebTools(ns, cfg);

    for (const t of targets) {
      await attemptRoot(ns, t, R.maxRuntimePerServerMs ?? 120000);
    }

    await ns.sleep(sweepMs);
  }

  // --- helpers
  function discoverAll(ns) {
    const seen = new Set(["home"]), q = ["home"];
    while (q.length) {
      const cur = q.shift();
      for (const n of ns.scan(cur)) if (!seen.has(n)) { seen.add(n); q.push(n); }
    }
    return [...seen];
  }

  async function tryBuyDarkwebTools(ns, cfg) {
    try {
      // These helpers exist in most versions if you have TOR:
      if (!ns.getDarkwebProgramList || !ns.purchaseDarkwebProgram) return;
      const list = ns.getDarkwebProgramList();
      const wallet = ns.getServerMoneyAvailable("home");
      const maxFrac = cfg.purchasePolicy?.darkwebMaxPriceFractionOfCash ?? 0.7;
      for (const p of list) {
        if (!p?.name) continue;
        if (ns.fileExists(p.name, "home")) continue;
        const cost = p.price ?? 0;
        if (cost <= wallet * maxFrac) {
          if (ns.purchaseDarkwebProgram(p.name)) ns.print(`rooting: purchased ${p.name} for ${fmtMoney(cost)}`);
        }
      }
    } catch (e) { ns.print("rooting: darkweb buy error: " + String(e)); }
  }

  async function attemptRoot(ns, host, perServerLimitMs) {
    const start = Date.now();
    const tools = [
      { name: "BruteSSH.exe", fn: (t)=>ns.brutessh(t) },
      { name: "FTPCrack.exe", fn: (t)=>ns.ftpcrack(t) },
      { name: "relaySMTP.exe", fn: (t)=>ns.relaysmtp(t) },
      { name: "HTTPWorm.exe", fn: (t)=>ns.httpworm(t) },
      { name: "SQLInject.exe", fn: (t)=>ns.sqlinject(t) }
    ];
    let opened = 0;
    for (const tool of tools) {
      if (ns.fileExists(tool.name, "home")) {
        try { tool.fn(host); opened++; } catch {}
      }
    }
    try { ns.nuke(host); } catch {}

    if (ns.hasRootAccess(host)) {
      ns.print(`rooting: NUKED ${host} (opened ${opened})`);
      // try backdoor if possible
      try {
        if (typeof ns.connect === "function") {
          const path = findPath(ns, "home", host);
          if (path) {
            for (let i=1;i<path.length;i++){ ns.connect(path[i]); await ns.sleep(40); }
            await tryInstallBackdoor(ns, host);
            for (let i=path.length-2;i>=0;i--){ ns.connect(path[i]); await ns.sleep(10); }
          }
        } else if (ns.fileExists("backdoor-worker-micro.js","home")) {
          await ns.scp("backdoor-worker-micro.js", host);
          ns.exec("backdoor-worker-micro.js", host, 1, host);
        }
      } catch {}
    } else {
      ns.print(`rooting: failed ${host}  (need ${ns.getServerNumPortsRequired(host)} ports, have tools=${tools.filter(t=>ns.fileExists(t.name,"home")).length})`);
    }

    const elapsed = Date.now() - start;
    if (elapsed < perServerLimitMs) await ns.sleep(20);
  }

  function findPath(ns, start, goal) {
    const q = [[start]], seen=new Set([start]);
    while (q.length) {
      const path = q.shift(), node = path[path.length-1];
      if (node === goal) return path;
      for (const n of ns.scan(node)) if (!seen.has(n)) { seen.add(n); q.push(path.concat([n])); }
    }
    return null;
  }

  async function tryInstallBackdoor(ns, host) {
    try {
      if (!ns.hasRootAccess(host)) return;
      const info = ns.getServer(host);
      if (info.backdoorInstalled) return;
      if (typeof ns.installBackdoor === "function") {
        await ns.installBackdoor();
        ns.print(`rooting: backdoored ${host}`);
      }
    } catch (e) { ns.print("rooting: backdoor error: " + String(e)); }
  }

  function updateRootingState(ns, patch){
    const file = "data-rooting_state.js";
    const cur = readObj(ns, file) || {};
    const next = Object.assign({}, cur, patch);
    next.summary = `pending=${next.pending ?? "?"}`;
    writeObj(ns, file, next, "rootingState");
  }

  function readObj(ns, file){
    try { if (!ns.fileExists(file,"home")) return null; const raw=ns.read(file)||""; const A=raw.indexOf("{"),B=raw.lastIndexOf("}"); if (A<0||B<0) return null; return JSON.parse(raw.slice(A,B+1)); } catch { return null; }
  }
  function writeObj(ns, file, obj, exportName="rootingState"){
    const body = `export const ${exportName} = ${JSON.stringify(obj,null,2)};\n`;
    ns.write(file, body, "w");
  }
  function fmtMoney(x){ if (!isFinite(x)) return `${x}`; if (Math.abs(x)>=1e9) return `$${(x/1e9).toFixed(2)}b`; if (Math.abs(x)>=1e6) return `$${(x/1e6).toFixed(2)}m`; if (Math.abs(x)>=1e3) return `$${(x/1e3).toFixed(2)}k`; return `$${x.toFixed(2)}`; }
}
