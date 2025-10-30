// workers-weaken.js
// Usage: run workers-weaken.js <target> [delayMs]
/** @param {NS} ns **/
export async function main(ns){
  const [target, delay] = [String(ns.args[0]||""), Number(ns.args[1]||0)];
  if (!target) { ns.tprint("workers-weaken: need target"); return; }
  if (delay>0) await ns.sleep(delay);
  try { await ns.weaken(target); } catch(e){ ns.print("workers-weaken err: "+e); }
}
