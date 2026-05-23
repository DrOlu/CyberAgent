#!/usr/bin/env node
// Sync-safety guardrail: confirm the desktop renderer bundle does not
// contain multiple copies of context-carrying React libraries.
//
// Background: pnpm's per-package peer resolution can materialize two
// copies of a library when the workspace has multiple React major/minor
// pins (apps/mobile pulls react@19.2.0 via react-native, the rest of the
// workspace uses 19.2.3 via the catalog). Vite then bundles both copies
// and the renderer crashes at module load with:
//
//   Uncaught Error: No QueryClient set, use QueryClientProvider to set one
//     at useQueryClient$1 (...)
//
// The fix lives in apps/desktop/electron.vite.config.ts (resolve.dedupe
// whitelist). This script asserts the whitelist is still complete by
// scanning the built renderer bundle for the rolldown-emitted $N suffix
// on any of the watched symbols. If it ever reappears, fail CI with a
// pointer to the dedupe list so the new library can be added.

import { readFileSync, readdirSync, statSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "..");
const bundleDir = resolve(repoRoot, "apps/desktop/out/renderer/assets");

// Each entry: a symbol that uniquely identifies a library's React-context
// instance. If rolldown emits `<symbol>$N` alongside `<symbol>` (or two
// $N variants), the library has been bundled twice.
const SENTINELS = [
  { lib: "@tanstack/react-query", symbol: "useQueryClient" },
  { lib: "@tanstack/react-query", symbol: "QueryClientContext" },
  { lib: "@tanstack/react-query", symbol: "QueryClientProvider" },
  // zustand exports `persist` from its middleware entrypoint. A duplicate
  // would mean two zustand instances (each with its own internal store
  // tracker) — Provider-less stores would silently desync.
  { lib: "zustand/middleware", symbol: "persist" },
  // react-router's `useNavigate` / `RouterProvider` were not affected in
  // the original bug but are equally context-driven; pin them defensively.
  { lib: "react-router-dom", symbol: "RouterProvider" },
  { lib: "react-i18next", symbol: "I18nextProvider" },
];

function findEntryBundle() {
  let entries;
  try {
    entries = readdirSync(bundleDir);
  } catch (err) {
    if (err.code === "ENOENT") {
      console.error(
        `Bundle directory ${bundleDir} does not exist — run pnpm --filter @multica/desktop build first.`,
      );
      process.exit(2);
    }
    throw err;
  }
  // The vite entry chunk is named `index-<hash>.js`. There is exactly one.
  const candidates = entries.filter(
    (n) => /^index-[A-Za-z0-9_-]+\.js$/.test(n),
  );
  if (candidates.length === 0) {
    console.error(
      `No index-*.js entry bundle found in ${bundleDir} — build output looks wrong.`,
    );
    process.exit(2);
  }
  if (candidates.length > 1) {
    // Multiple entry chunks shouldn't happen with the current vite config;
    // if it does, scan all of them so we don't miss a duplicate.
    return candidates.map((n) => join(bundleDir, n));
  }
  return [join(bundleDir, candidates[0])];
}

function findDuplicateSuffixes(src, symbol) {
  // Match `<symbol>` followed by an optional `$<digit(s)>`. We care about
  // distinct identifiers — `useQueryClient` and `useQueryClient$1` count
  // as two separate identifiers, which means the library is duplicated.
  const re = new RegExp(`\\b${symbol}(\\$\\d+)?\\b`, "g");
  const seen = new Set();
  for (const m of src.matchAll(re)) {
    seen.add(m[0]);
  }
  return seen;
}

const entryPaths = findEntryBundle();
const failures = [];
const allSrc = entryPaths.map((p) => readFileSync(p, "utf-8")).join("\n");
const totalBytes = entryPaths.reduce((sum, p) => sum + statSync(p).size, 0);
console.log(
  `Scanning ${entryPaths.length} entry bundle(s) (${(totalBytes / 1024 / 1024).toFixed(1)} MB) for duplicate React-context symbols`,
);

for (const sentinel of SENTINELS) {
  const variants = findDuplicateSuffixes(allSrc, sentinel.symbol);
  if (variants.size === 0) {
    // Symbol not present at all — library may have been removed or
    // tree-shaken. Skip silently rather than fail; the build itself
    // would catch a missing import.
    continue;
  }
  if (variants.size === 1) {
    console.log(`✓ ${sentinel.lib} — single instance (${[...variants][0]})`);
    continue;
  }
  failures.push({ ...sentinel, variants: [...variants] });
}

if (failures.length === 0) {
  console.log("");
  console.log(`All ${SENTINELS.length} React-context sentinels are single-instance.`);
  process.exit(0);
}

console.error("");
console.error("✗ Duplicate instances of context-carrying React libraries detected");
console.error("  in the desktop renderer bundle:");
console.error("");
for (const f of failures) {
  console.error(`  ${f.lib} (symbol ${f.symbol}):`);
  for (const v of f.variants) {
    console.error(`    - ${v}`);
  }
}
console.error("");
console.error("This is the same class of bug that caused the v1.5.0–v1.5.2 desktop");
console.error("releases to launch into a blank window with");
console.error('  Uncaught Error: No QueryClient set, use QueryClientProvider to set one');
console.error("");
console.error("Fix: add the affected library to the `dedupe` array in");
console.error("apps/desktop/electron.vite.config.ts. Then rebuild and re-run this");
console.error("script to confirm the duplicate suffix is gone.");
process.exit(1);
