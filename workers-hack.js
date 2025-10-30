// workers-hack.js
// Usage: run workers-hack.js <target> [delayMs]
/** @param {NS} ns **/
export async function main(ns){
  const [target, delay] = [String(ns.args[0]||""), Number(ns.args[1]||0)];
  if (!target) { ns.tprint("workers-hack: need target"); return; }
  if (delay>0) await ns.sleep(delay);
  try { await ns.hack(target); } catch(e){ ns.print("workers-hack err: "+e); }
}
