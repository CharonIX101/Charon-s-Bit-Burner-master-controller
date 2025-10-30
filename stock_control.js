// stock_control.js
export async function main(ns) {
  const args = ns.args.map(String);
  if (!args.length) { ns.tprint("Usage: run stock_control.js <start|stop|reset>"); return; }
  const msg = args.join(" ");
  const ok = ns.tryWritePort(20, msg);
  if (ok) ns.tprint(`✅ Sent control: "${msg}" on port 20`);
  else ns.tprint("⚠️ Port 20 busy; try again");
}
