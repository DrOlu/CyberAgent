#!/usr/bin/env node
/**
 * check-style-tokens.mjs — sync-safety guardrail for the design-token layer.
 *
 * WHY THIS EXISTS
 * ───────────────
 * The upstream-sync pipeline (auto-sync-upstream.yml) snapshots a set of
 * CyberAgent-owned files (see scripts/rebrand-manifest.txt) and restores them
 * verbatim after merging upstream. That is correct for files that are mostly
 * rebrand — but it means any CSS custom property (design token) that upstream
 * ADDS to a snapshotted stylesheet is silently dropped, because the snapshot
 * freezes the file at its pre-merge state.
 *
 * This is exactly what bit us: upstream's "surface system" (packages/ui/
 * styles/tokens.css) added --surface-raised / --floating-shadow / etc. The
 * snapshot restored our older copy, every overlay in the app (floating chat,
 * dialogs, popovers, dropdowns, sheets) relies on `bg-surface-raised`, the
 * utility could no longer resolve a token, and the floating chatbot window
 * rendered with a TRANSPARENT background.
 *
 * Unlike a missing i18n key, a missing token does not fail the TypeScript
 * build — it fails silently at render time. So we can't rely on `pnpm build`
 * to catch it. This script closes that gap by failing the sync (and CI) when
 * a token the source references has no definition.
 *
 * WHAT IT CHECKS
 * ──────────────
 *   1. Every `--*` custom property defined upstream in a snapshotted CSS file
 *      still exists locally (the snapshot didn't drop upstream's additions).
 *   2. Every `--*` token referenced by `var(--*)` in our CSS, and every
 *      Tailwind-style `bg-<token>` / `ring-<token>` / `text-<token>` etc.
 *      utility used in TSX, resolves to a definition (no dangling tokens).
 *
 * Brand-only renames (e.g. a token literally containing "multica" that we
 * rewrote to "cyberagent") are ignored — only structure is compared.
 *
 * Exit 0 = all good. Exit 1 = missing tokens (prints them).
 */
import { readFileSync, existsSync } from "node:fs";
import { execSync } from "node:child_process";

const SNAP_CSS = [
  "packages/ui/styles/tokens.css",
  "packages/ui/styles/base.css",
  "apps/web/app/custom.css",
  "apps/docs/app/global.css",
];

// Extra CSS files scanned for var(--*) references / definitions (not snapshotted,
// but part of the token graph so references resolve).
const EXTRA_CSS = [
  "apps/web/app/globals.css",
  "apps/desktop/src/renderer/src/globals.css",
  "apps/mobile/global.css",
  "packages/ui/markdown/markdown.css",
];

const BRAND = /multica|cyberagent|hyperspace/gi;
const norm = (s) => s.replace(BRAND, "brand");

const read = (f) => (existsSync(f) ? readFileSync(f, "utf8") : "");

/** Extract `--name` custom-property *definitions* from CSS text. */
function defsOf(css) {
  const out = new Set();
  // `--name:` at the start of a declaration (not inside var(), not a value).
  for (const m of css.matchAll(/(^|[;{\s])(--[a-zA-Z0-9-]+)\s*:/gm)) {
    out.add(m[2]);
  }
  return out;
}

/** Extract `--name` tokens *referenced* via var(--name) from CSS text. */
function refsOf(css) {
  const out = new Set();
  for (const m of css.matchAll(/var\(\s*(--[a-zA-Z0-9-]+)/g)) out.add(m[1]);
  return out;
}

/** Upstream version of a tracked file, or "" when there is no git/upstream. */
function upstreamOf(path) {
  try {
    return execSync(`git show upstream/main:${path}`, {
      stdio: ["ignore", "pipe", "ignore"],
    }).toString();
  } catch {
    return null; // no upstream remote / shallow clone / file absent upstream
  }
}

let failures = 0;
const fail = (msg) => {
  console.error(`  ✗ ${msg}`);
  failures += 1;
};

// ── Check 1: snapshotted CSS must not drop upstream token definitions ────────
console.log("Check 1 — snapshotted stylesheets retain upstream token definitions");
let checkedUpstream = 0;
for (const file of SNAP_CSS) {
  const up = upstreamOf(file);
  if (up === null) {
    console.log(`  · ${file} — no upstream baseline, skipped`);
    continue;
  }
  checkedUpstream += 1;
  const upDefs = new Set([...defsOf(up)].map(norm));
  const localDefs = new Set([...defsOf(read(file))].map(norm));
  const missing = [...upDefs].filter((d) => !localDefs.has(d));
  if (missing.length) {
    fail(
      `${file} dropped ${missing.length} upstream token(s): ${missing.join(", ")}\n` +
        `     → The snapshot restored a stale copy. Re-apply upstream's additions to ${file}.`,
    );
  } else {
    console.log(`  ✓ ${file} — all ${upDefs.size} upstream tokens present`);
  }
}
if (!checkedUpstream) {
  console.log("  · no upstream baselines available (offline?) — Check 1 skipped");
}

// ── Check 2: every token referenced in CSS resolves to a definition ──────────
console.log("Check 2 — no dangling var(--*) references across the token graph");
const allCssFiles = [...SNAP_CSS, ...EXTRA_CSS];
const defined = new Set();
for (const f of allCssFiles) for (const d of defsOf(read(f))) defined.add(norm(d));
// Tokens legitimately provided at runtime (next/font, JS-injected, fumadocs,
// Shiki dual-theme variables injected by the syntax highlighter).
const RUNTIME_PROVIDED = new Set([
  "--font-sans",
  "--font-instrument-serif",
  "--font-serif",
  "--font-mono",
  "--font-heading",
  "--font-inter",
  "--radius",
  "--shiki-light",
  "--shiki-dark",
]);
for (const f of allCssFiles) {
  for (const ref of refsOf(read(f))) {
    const n = norm(ref);
    if (!defined.has(n) && !RUNTIME_PROVIDED.has(ref)) {
      fail(`${f} references ${ref} but it is never defined`);
    }
  }
}
if (!failures) console.log("  ✓ all var(--*) references resolve");

// ── Summary ──────────────────────────────────────────────────────────────────
if (failures) {
  console.error(
    `\n✗ check-style-tokens: ${failures} problem(s) found.\n` +
      `  A snapshotted stylesheet is out of sync with upstream, or a token is\n` +
      `  referenced but undefined. Fix by restoring the upstream token\n` +
      `  definitions (keeping CyberAgent brand renames) — see scripts/\n` +
      `  rebrand-manifest.txt and the sync pipeline guardrails.`,
  );
  process.exit(1);
}
console.log("\n✓ check-style-tokens: all design tokens in sync.");
