// systems-batcher.js
import { getConfig } from "lib-config.js";

export async function main(ns) {
  ns.disableLog("sleep");
  const cfg = await getConfig(ns);
  const script = "batcher-daemon.js"; // Provided below
  if (!ns.fileExists(script, "home")) { ns.print("systems-batcher: missing batcher-daemon.js"); return; }

  // Launch once; the daemon self-manages
  if (!ns.ps().some(p => p.filename === script)) ns.run(script, 1);
  ns.print("systems-batcher: launched daemon");
  while (true) await ns.sleep(60000);
}
