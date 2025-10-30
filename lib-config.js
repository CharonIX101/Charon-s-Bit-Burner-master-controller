// lib-config.js
// Safe helper to read object exported by data-master-config.js

export async function getConfig(ns, file = "data-master-config.js") {
  try {
    if (!ns.fileExists(file, "home")) return {};
    const raw = ns.read(file) || "";
    const a = raw.indexOf("{");
    const b = raw.lastIndexOf("}");
    if (a < 0 || b < 0) return {};
    return JSON.parse(raw.slice(a, b + 1));
  } catch (e) {
    ns.tprint("lib-config: parse error: " + String(e));
    return {};
  }
}
