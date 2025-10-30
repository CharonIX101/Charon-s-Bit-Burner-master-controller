/** RootV3.js — Robust rooting tool with optional backdoor + self-propagation
 *
 * Examples:
 *  run RootV3.js n00dles
 *  run RootV3.js --targets=foodnstuff,joesguns --backdoor=true
 *  run RootV3.js --all --backdoor=true --execSelfOnTarget=true --remoteThreads=1
 *  run RootV3.js --all --copy=someHelper.js --run="systems-batcher.js --flagX" --threads=1
 *
 * Flags (both --k=v and space style supported):
 *  --targets=csv            Comma-separated targets (ex: a,b,c). Mutually exclusive with --all and positional single target.
 *  --all                    Scan() the entire network and try to root everything (except 'home').
 *  --exclude=csv            Comma-separated hosts to skip (root/backdoor operations will be skipped).
 *
 *  --copy=file              Optionally SCP this extra file to newly rooted servers (from home).
 *  --copyExes=true          Also copy port-cracker EXEs to the target (noisy; usually unnecessary).
 *
 *  --run="script args..."   After rooting a host, execute this command on --execHost (default "home").
 *  --execHost=host          Where to run the --run script (default "home").
 *  --threads=N              Thread count for --run (default 1).
 *
 *  --backdoor=true          Try to install a backdoor after root (default: false).
 *                           Safety: Will NEVER backdoor your private servers (GhostWorkerServer, GhostFarm*).
 *                           If ns.connect() is unavailable, will try backdoor-worker-micro.js on target (if present) else skip.
 *
 *  --execSelfOnTarget=true  After rooting, copy this script to the target and exec it there (propagation).
 *  --remoteThreads=N        Threads to use when auto-execing this script on the target (default 1).
 *
 * Notes:
 *  - All filenames are flat (no folders), per Bitburner constraints.
 *  - Script name is case-sensitive. Save this file exactly as "RootV3.js".
 */

export async function main(ns) {
  ns.disableLog("ALL");
  const selfName = ns.getScriptName();

  // ------------ parse flags ------------
  const flags = parseFlags(ns.args);

  const doAll        = truthy(flags.all);
  const doBackdoor   = truthy(flags.backdoor);
  const execSelf     = truthy(flags.execSelfOnTarget);
  const copyExes     = truthy(flags.copyExes);
  const extraCopy    = flags.copy ? String(flags.copy) : null;

  const execHost     = flags.execHost ? String(flags.execHost) : "home";
  const runCmd       = flags.run ? String(flags.run) : null;
  const runThreads   = flags.threads ? Math.max(1, parseInt(flags.threads,10)) : 1;
  const remoteThreads= flags.remoteThreads ? Math.max(0, parseInt(flags.remoteThreads,10)) : 1;

  // exclusion list (optional)
  const excludes = new Set(
    (flags.exclude ? String(flags.exclude) : "")
      .split(",").map(s => s.trim()).filter(Boolean)
  );

  // determine targets
  let targets = [];
  if (doAll) {
    targets = getAllServers(ns).filter(s => s !== "home");
  } else if (flags.targets) {
    targets = String(flags.targets).split(",").map(s => s.trim()).filter(Boolean);
  } else if (ns.args.length > 0 && !String(ns.args[0]).startsWith("--")) {
    targets = [String(ns.args[0])];
  } else {
    ns.tprint("Usage: run RootV3.js <target>  OR  run RootV3.js --targets=a,b  OR  run RootV3.js --all");
    ns.tprint("       (Add --backdoor=true to backdoor; see script header for more flags)");
    return;
  }

  // Apply excludes if any
  if (excludes.size > 0) {
    targets = targets.filter(t => !excludes.has(t));
  }

  // canonical port tools in order
  const portTools = [
    { name: "BruteSSH.exe", fn: t => ns.brutessh(t) },
    { name: "FTPCrack.exe", fn: t => ns.ftpcrack(t) },
    { name: "relaySMTP.exe", fn: t => ns.relaysmtp(t) },
    { name: "HTTPWorm.exe", fn: t => ns.httpworm(t) },
    { name: "SQLInject.exe", fn: t => ns.sqlinject(t) }
  ];
  const ownedTools = portTools.filter(p => ns.fileExists(p.name, "home")).map(p => p.name);

  ns.tprint(`RootV3: targets=${targets.join(", ")} | tools=[${ownedTools.join(", ") || "none"}] | backdoor=${doBackdoor} | propagate=${execSelf}`);

  for (const target of targets) {
    try {
      if (!ns.serverExists(target)) {
        ns.tprint(`[SKIP] ${target} — server not found`);
        continue;
      }

      // Attempt root if needed
      if (!ns.hasRootAccess(target)) {
        await attemptRoot(ns, target, portTools);
      } else {
        ns.tprint(`[ALREADY ROOTED] ${target}`);
      }

      // Copy this script to target (handy even if we don't propagate)
      await tryCopy(ns, selfName, target);

      // Optionally copy an extra file
      if (extraCopy) await tryCopy(ns, extraCopy, target);

      // Optionally copy port-cracker exes (noisy; usually not needed)
      if (copyExes && ownedTools.length) {
        for (const exe of ownedTools) await tryCopy(ns, exe, target);
      }

      // Optional: run a command from execHost
      if (runCmd) {
        await tryRun(ns, execHost, runCmd, runThreads);
      }

      // Optional: backdoor (with all the safety checks & fallbacks)
      if (doBackdoor) {
        await safeBackdoor(ns, target);
      }

      // Optional: propagate (start this script on the target)
      if (execSelf) {
        await propagateSelf(ns, selfName, target, remoteThreads, { doBackdoor, copyExes, extraCopy });
      }

    } catch (e) {
      ns.tprint(`[ERROR] while processing ${target}: ${String(e)}`);
    }
  }

  ns.tprint("RootV3: finished.");
}

/* ============================ helpers ============================ */

function truthy(v) {
  if (v === true) return true;
  if (typeof v === "string") return v.toLowerCase() === "true";
  return false;
}

async function attemptRoot(ns, target, portTools) {
  let opened = 0;
  for (const tool of portTools) {
    if (ns.fileExists(tool.name, "home")) {
      try { tool.fn(target); opened++; } catch {}
    }
  }
  try { ns.nuke(target); } catch {}
  if (ns.hasRootAccess(target)) {
    ns.tprint(`[NUKED] ${target} (opened ${opened} ports)`);
  } else {
    const reqPorts = ns.getServerNumPortsRequired(target);
    const reqHack  = ns.getServerRequiredHackingLevel(target);
    ns.tprint(`[FAILED] ${target} — need ${reqPorts} ports (you have ${ownedCount(ns)}); reqHack ${reqHack}, yourHack ${ns.getHackingLevel()}`);
  }
}

function ownedCount(ns) {
  const names = ["BruteSSH.exe","FTPCrack.exe","relaySMTP.exe","HTTPWorm.exe","SQLInject.exe"];
  return names.filter(n => ns.fileExists(n, "home")).length;
}

async function tryCopy(ns, file, target) {
  try {
    if (!ns.fileExists(file, "home")) {
      ns.tprint(`[COPY SKIP] ${file} not found on home`);
      return;
    }
    const ok = await ns.scp(file, target);
    ns.tprint(ok ? `[COPY] ${file} -> ${target}` : `[COPY FAIL] ${file} -> ${target}`);
  } catch (e) {
    ns.tprint(`[COPY ERROR] ${file} -> ${target}: ${String(e)}`);
  }
}

async function tryRun(ns, execHost, runCmd, threads) {
  try {
    const parts = runCmd.split(" ").map(s => s.trim()).filter(Boolean);
    const script = parts.shift();
    if (!script) return;
    const pid = ns.exec(script, execHost, Math.max(1, threads|0), ...parts);
    if (pid === 0) ns.tprint(`[RUN FAIL] ${script} on ${execHost} (threads=${threads})`);
    else ns.tprint(`[RUN] ${script} on ${execHost} (pid ${pid})`);
  } catch (e) {
    ns.tprint(`[RUN ERROR] ${runCmd} on ${execHost}: ${String(e)}`);
  }
}

function isPurchasedServer(name) {
  if (!name) return false;
  if (name === "GhostWorkerServer") return true;
  if (name.startsWith("GhostFarm")) return true;
  return false;
}

async function safeBackdoor(ns, target) {
  // Never backdoor your purchased servers (but rooting them is fine)
  if (isPurchasedServer(target)) {
    ns.tprint(`[BACKDOOR SKIP] ${target} — purchased server`);
    return;
  }
  if (!ns.hasRootAccess(target)) {
    ns.tprint(`[BACKDOOR SKIP] ${target} — no root`);
    return;
  }

  try {
    const info = ns.getServer(target);
    if (info.backdoorInstalled) {
      ns.tprint(`[BACKDOOR] already installed on ${target}`);
      return;
    }
  } catch {}

  // Preferred: interactive connect path + installBackdoor (if available)
  if (typeof ns.connect === "function" && typeof ns.installBackdoor === "function") {
    const path = findPath(ns, "home", target);
    if (!path) {
      ns.tprint(`[BACKDOOR FAIL] ${target} — path not found`);
      return;
    }
    try {
      for (let i = 1; i < path.length; i++) { ns.connect(path[i]); await ns.sleep(50); }
      await ns.installBackdoor();
      ns.tprint(`[BACKDOOR] installed on ${target}`);
    } catch (e) {
      ns.tprint(`[BACKDOOR ERROR] ${target}: ${String(e)}`);
    } finally {
      try { for (let i = path.length - 2; i >= 0; i--) { ns.connect(path[i]); await ns.sleep(10); } } catch {}
    }
    return;
  }

  // Fallback: try to run backdoor-worker-micro.js ON the target (must have RAM)
  if (ns.fileExists("backdoor-worker-micro.js", "home")) {
    try {
      await ns.scp("backdoor-worker-micro.js", target);
      const scriptRam = ns.getScriptRam("backdoor-worker-micro.js", target) || 2.0;
      const maxRam    = ns.getServerMaxRam(target);
      const usedRam   = ns.getServerUsedRam(target);
      if ((maxRam - usedRam) >= scriptRam) {
        const pid = ns.exec("backdoor-worker-micro.js", target, 1, target);
        if (pid > 0) ns.tprint(`[BACKDOOR] launched micro-worker on ${target} (pid ${pid})`);
        else ns.tprint(`[BACKDOOR FAIL] could not exec micro-worker on ${target}`);
      } else {
        ns.tprint(`[BACKDOOR SKIP] insufficient RAM on ${target} for micro-worker`);
      }
    } catch (e) {
      ns.tprint(`[BACKDOOR ERROR] micro-worker on ${target}: ${String(e)}`);
    }
  } else {
    ns.tprint(`[BACKDOOR SKIP] ns.connect/installBackdoor unavailable and backdoor-worker-micro.js not present`);
  }
}

async function propagateSelf(ns, selfName, target, remoteThreads, opts) {
  try {
    if (!ns.fileExists(selfName, target)) {
      // ensure it's present
      await ns.scp(selfName, target);
    }
    const scriptRam = ns.getScriptRam(selfName, target);
    const freeRam   = ns.getServerMaxRam(target) - ns.getServerUsedRam(target);
    if (freeRam < scriptRam) {
      ns.tprint(`[AUTOEXEC SKIP] ${target}: insufficient free RAM (${freeRam.toFixed(2)} GB, need ${scriptRam.toFixed(2)} GB).`);
      return;
    }

    // Reconstruct a minimal, safe flag set to continue propagation if you want
    const args = [];
    if (opts && opts.extraCopy)  args.push(`--copy=${opts.extraCopy}`);
    if (opts && opts.copyExes)   args.push(`--copyExes=true`);
    if (opts && opts.doBackdoor) args.push(`--backdoor=true`);
    // If you want the remote instance to explore, give it --all (careful: can explode graph-wide)
    // Here we'll have it just handle itself + neighbors if user passes positional target later.

    // Default behavior: run on target with no positional targets (prints usage if no flags to act on)
    const pid = ns.exec(selfName, target, Math.max(1, remoteThreads|0), target);
    if (pid > 0) ns.tprint(`[AUTOEXEC] started ${selfName} on ${target} x${remoteThreads} (pid ${pid})`);
    else ns.tprint(`[AUTOEXEC FAIL] could not exec ${selfName} on ${target}`);
  } catch (e) {
    ns.tprint(`[AUTOEXEC ERROR] ${target}: ${String(e)}`);
  }
}

function getAllServers(ns) {
  const seen = new Set(["home"]);
  const q = ["home"];
  while (q.length) {
    const cur = q.shift();
    for (const n of ns.scan(cur)) {
      if (!seen.has(n)) { seen.add(n); q.push(n); }
    }
  }
  return [...seen];
}

function findPath(ns, start, goal) {
  const q = [[start]];
  const seen = new Set([start]);
  while (q.length) {
    const path = q.shift();
    const node = path[path.length - 1];
    if (node === goal) return path;
    for (const neigh of ns.scan(node)) {
      if (!seen.has(neigh)) {
        seen.add(neigh);
        q.push(path.concat([neigh]));
      }
    }
  }
  return null;
}

function parseFlags(args) {
  // Simple tolerant parser: supports --k=v and space-separated pairs
  const out = {};
  for (let i = 0; i < args.length; i++) {
    const a = String(args[i]);
    if (a.startsWith("--")) {
      const eq = a.indexOf("=");
      if (eq >= 0) {
        const k = a.slice(2, eq);
        const v = a.slice(eq + 1);
        out[k] = v === "" ? true : v;
      } else {
        // Maybe the next token is the value (if it doesn't start with --)
        const k = a.slice(2);
        const n = String(args[i+1] ?? "");
        if (n && !n.startsWith("--")) { out[k] = n; i++; }
        else { out[k] = true; }
      }
    } else {
      // positional arg is ignored here; handled earlier to disambiguate single target
    }
  }
  return out;
}
