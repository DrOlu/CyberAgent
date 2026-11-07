#!/usr/bin/env node
// Sync-safety guardrail: confirm the desktop MAIN bundle does not externalize
// any ESM-only production dependency.
//
// Background: electron-vite's externalizeDepsPlugin() compiles every
// `import x from "dep"` in the main process to a bare CJS `require("dep")`
// in out/main/index.js. For dependencies that ship as CJS that is fine, but
// an ESM-only package ("type": "module" and no "require" export condition)
// resolves at runtime to the module NAMESPACE object, not a callable — so
// the call site throws `TypeError: x is not a function`. This bit v1.5.x:
// fix-path v5 was externalized and the top-level fixPath() PATH-recovery
// call crashed every macOS/Linux launch with
//
//   A JavaScript error occurred in the main process
//   Uncaught Exception: TypeError: fixPath is not a function
//     at Object.<anonymous> (.../app.asar/out/main/index.js)
//
// (Windows never imported the module's crash path because the fixPath call
// is guarded by process.platform !== "win32", and no CI job ever LAUNCHED
// the packaged app — packaging alone does not execute out/main/index.js.)
//
// The fix lives in apps/desktop/electron.vite.config.ts:
//   externalizeDepsPlugin({ exclude: ["fix-path"] })
// This script generalizes that fix: it fails if ANY production dependency
// imported by the main bundle is ESM-only, with a pointer to the exclude
// list, so the next `pnpm add` of an ESM-only dep cannot ship another
// launch-crashing release.
//
// Run as:
//   node scripts/check-main-bundle-esm-deps.mjs

import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "..");
const desktopRoot = resolve(repoRoot, "apps/desktop");
const bundlePath = resolve(desktopRoot, "out/main/index.js");

const desktopRequire = createRequire(resolve(desktopRoot, "package.json"));

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

// Normalize a package.json `exports` field into a list of condition-key
// trees so we can look for a CJS entry ("require" / "node") on any branch.
function collectExportConditions(exports, out) {
  if (exports == null) return;
  if (typeof exports === "string") return; // a plain target — no conditions
  if (Array.isArray(exports)) {
    for (const entry of exports) collectExportConditions(entry, out);
    return;
  }
  for (const [key, value] of Object.entries(exports)) {
    if (key === "default" || key === "types") continue; // target keys, not conditions
    out.add(key);
    collectExportConditions(value, out);
  }
}

// A dependency is ESM-only when, under its own package.json, the resolved
// entry is an ES module: "type": "module" plus an entry surface with no
// CJS require hook ("require" or "node" condition, or a .cjs main).
// Dual packages (both "import" and "require" conditions, or commonjs type)
// are safe to externalize — Node's require() gets the CJS build.
function isEsmOnly(name) {
  let pkg;
  try {
    pkg = readJson(desktopRequire.resolve(`${name}/package.json`));
  } catch {
    // Scoped dep whose package.json isn't resolvable via name/package.json
    // exports (exports map without that subpath). Fall back to a shallow
    // directory read; if that fails too, treat as unknown → not flagged.
    try {
      const base = name.split("/").slice(0, 2).join("/");
      pkg = readJson(
        resolve(dirname(desktopRequire.resolve(name)), "package.json"),
      );
      void base;
    } catch {
      return false;
    }
  }
  if (pkg.type !== "module") return false;
  const conditions = new Set();
  if (pkg.exports !== undefined) {
    collectExportConditions(pkg.exports, conditions);
    if (conditions.has("require") || conditions.has("node")) return false;
    return true;
  }
  // No exports map: "type": "module" makes main (default index.js) ESM.
  return !(pkg.main ?? "index.js").endsWith(".cjs");
}

function findEntryBundle() {
  try {
    return readFileSync(bundlePath, "utf8");
  } catch (err) {
    if (err.code === "ENOENT") {
      console.error(
        `Main bundle ${bundlePath} does not exist — run pnpm --filter @multica/desktop build first.`,
      );
      process.exit(2);
    }
    throw err;
  }
}

const src = findEntryBundle();

// Every static require of a bare package name emitted in the CJS bundle.
// Bare-name requires map to externalized dependencies; builtins (node:*)
// and relative paths are irrelevant here.
const requiredNames = new Set();
for (const match of src.matchAll(/\brequire\(\s*["']([^"']+)["']\s*\)/g)) {
  const spec = match[1];
  if (spec.startsWith("node:") || spec.startsWith(".") || spec.startsWith("/")) {
    continue;
  }
  // Strip subpaths: "@scope/pkg/sub" → "@scope/pkg", "pkg/sub" → "pkg".
  const parts = spec.split("/");
  const base = spec.startsWith("@") ? parts.slice(0, 2).join("/") : parts[0];
  requiredNames.add(base);
}

const prodDeps = {
  ...readJson(resolve(desktopRoot, "package.json")).dependencies,
  ...readJson(resolve(desktopRoot, "package.json")).peerDependencies,
};

const offenders = [...requiredNames]
  .filter((name) => name in prodDeps)
  .filter((name) => isEsmOnly(name));

if (offenders.length > 0) {
  console.error(
    [
      "ESM-only production dependency(ies) externalized in the desktop MAIN bundle:",
      ...offenders.map((n) => `  - ${n}`),
      "",
      "Calling an externalized ESM-only dep from CJS throws",
      "`TypeError: <name> is not a function` at app launch (see v1.5.x).",
      "",
      "Fix: add the package(s) to the externalizeDepsPlugin exclude list in",
      "apps/desktop/electron.vite.config.ts so Rollup inlines the ESM module:",
      '  plugins: [externalizeDepsPlugin({ exclude: ["' +
        offenders.join('", "') +
        '"] })]',
    ].join("\n"),
  );
  process.exit(1);
}

console.log(
  `OK — no ESM-only dependency is externalized in out/main/index.js ` +
    `(${requiredNames.size} external require sites scanned).`,
);
