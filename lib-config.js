// lib-config.js
// Robust loader for data-master-config.js (which is JS with comments).
// Strategy: read file -> strip "export const masterConfig =" wrapper
// -> remove comments -> remove trailing commas -> JSON.parse the object body.

function stripExportWrapper(raw) {
  // Remove everything before the first '{' and after the last '}'
  // but first trim off the leading "export const masterConfig ="
  // and any trailing semicolon.
  // This keeps the inner object only.
  const firstBrace = raw.indexOf("{");
  const lastBrace = raw.lastIndexOf("}");
  if (firstBrace < 0 || lastBrace < 0) return "";
  return raw.slice(firstBrace, lastBrace + 1);
}

function stripComments(s) {
  // Remove // line comments and /* block */ comments
  // Careful: this is a simple stripper good enough for our config structure.
  return s
    // block comments
    .replace(/\/\*[\s\S]*?\*\//g, "")
    // line comments
    .replace(/(^|[^:])\/\/.*$/gm, (m, p1) => p1);
}

function stripTrailingCommas(s) {
  // Remove trailing commas before } or ]
  // e.g., { a: 1, } -> { a: 1 }
  //       [1,2,]   -> [1,2]
  return s.replace(/,\s*([}\]])/g, "$1");
}

export async function getConfig(ns, file = "data-master-config.js") {
  try {
    if (!ns.fileExists(file, "home")) {
      ns.tprint(`lib-config: ${file} not found; using empty config`);
      return {};
    }
    const raw = ns.read(file) || "";
    let body = stripExportWrapper(raw);
    body = stripComments(body);
    body = stripTrailingCommas(body);

    // JSON.parse will now work on the cleaned body
    const parsed = JSON.parse(body);
    return parsed || {};
  } catch (e) {
    ns.tprint("lib-config: parse error: " + String(e));
    return {};
  }
}
