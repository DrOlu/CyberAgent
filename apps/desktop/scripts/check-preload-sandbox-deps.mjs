/**
 * Sandboxed preload dependency guard.
 *
 * The renderer windows run with `sandbox: true`, and a sandboxed preload's
 * `require` can only load `electron` plus a couple of node builtins. Any
 * other bare require throws "module not found" at runtime and the preload
 * dies — every contextBridge API vanishes and the window is bricked
 * (v1.5.374 shipped exactly this: @electron-toolkit/preload externalized
 * while main/index.ts had moved to sandbox: true).
 *
 * This fails the build when out/preload/index.js contains a bare require
 * of a node_modules package. Everything but the sandbox-allowed modules
 * must be bundled by electron-vite (externalizeDepsPlugin exclude list in
 * electron.vite.config.ts).
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const bundle = resolve(here, "../out/preload/index.js");
const ALLOWED = new Set(["electron", "events", "timers", "url"]);

let src;
try {
  src = readFileSync(bundle, "utf8");
} catch {
  console.error(
    `::error::Cannot read ${bundle} — run "pnpm exec electron-vite build" first.`,
  );
  process.exit(1);
}

const specifiers = new Set();
for (const match of src.matchAll(/\brequire\(\s*(["'])([^"')]+)\1\s*\)/g)) {
  specifiers.add(match[2]);
}

const bare = [...specifiers].filter(
  (s) =>
    !ALLOWED.has(s) &&
    !s.startsWith("node:") &&
    !s.startsWith("./") &&
    !s.startsWith("../"),
);

if (bare.length > 0) {
  console.error(
    "::error::out/preload/index.js requires node_modules packages at runtime — a sandboxed preload cannot load them (module not found → dead window). Add them to the externalizeDepsPlugin exclude list in electron.vite.config.ts so they are bundled:",
  );
  for (const s of bare.sort()) console.error(`  - ${s}`);
  process.exit(1);
}

console.log(
  `OK — preload bundle has no external node_modules requires (${specifiers.size} require site(s) scanned).`,
);
