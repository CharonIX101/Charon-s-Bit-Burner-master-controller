// workers-grow.js
// Usage: run workers-grow.js <target> [delayMs]
/** @param {NS} ns **/
export async function main(ns){
  const [target, delay] = [String(ns.args[0]||""), Number(ns.args[1]||0)];
  if (!target) { ns.tprint("workers-grow: need target"); return; }
  if (delay>0) await ns.sleep(delay);
  try { await ns.grow(target); } catch(e){ ns.print("workers-grow err: "+e); }
}
