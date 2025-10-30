// backdoor-worker-micro.js
/** Install a backdoor on the host this runs on (must have root). */
export async function main(ns) {
  const here = ns.getHostname();
  try {
    if (!ns.hasRootAccess(here)) { ns.tprint(`micro: no root on ${here}`); return; }
    const info = ns.getServer(here);
    if (info.backdoorInstalled) { ns.print(`micro: already backdoored ${here}`); return; }
    if (typeof ns.installBackdoor === "function") {
      await ns.installBackdoor();
      ns.print(`micro: backdoored ${here}`);
    } else {
      ns.tprint("micro: installBackdoor not available");
    }
  } catch (e) {
    ns.tprint("micro: error " + String(e));
  }
}
