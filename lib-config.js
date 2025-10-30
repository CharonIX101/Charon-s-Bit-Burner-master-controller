// lib-config.js
// Robust loader for a commented JS object exported as:
//   export const masterConfig = { ... };

function stripExportWrapper(raw) {
  const first = raw.indexOf("{");
  const last  = raw.lastIndexOf("}");
  if (first < 0 || last < 0) return "";
  return raw.slice(first, last + 1);
}

function stripComments(s) {
  // Remove /* block */ and // line comments (not perfect, but OK for config)
  return s
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:\\])\/\/.*$/gm, (m, p1) => p1); // keep 'http://'
}

function stripTrailingCommas(s) {
  return s.replace(/,\s*([}\]])/g, "$1");
}

function quoteUnquotedKeys(s) {
  // Turn: { foo: 1, bar_baz: true } -> { "foo": 1, "bar_baz": true }
  return s.replace(/([{\s,])([A-Za-z_][A-Za-z0-9_]*)\s*:/g, '$1"$2":');
}

export async function getConfig(ns, file = "data-master-config.js") {
  try {
    if (!ns.fileExists(file, "home")) {
      ns.tprint(`lib-config: ${file} not found; using empty config`);
      return {};
    }
    let body = stripExportWrapper(ns.read(file) || "");
    body = stripComments(body);
    body = quoteUnquotedKeys(body);
    body = stripTrailingCommas(body);

    const parsed = JSON.parse(body);
    return parsed || {};
  } catch (e) {
    ns.tprint("lib-config: parse error: " + String(e));
    return {};
  }
}
