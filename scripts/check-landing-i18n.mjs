#!/usr/bin/env node
// Sync-safety guardrail: verify the landing-page i18n dictionaries have not
// drifted behind the LandingDict type definition.
//
// Background: apps/web/features/landing/i18n/en.ts and zh.ts are
// snapshotted via scripts/rebrand-manifest.txt so the rebrand pipeline can
// preserve our CyberAgent-rewritten copy across upstream merges. But the
// TYPE definition in apps/web/features/landing/i18n/types.ts is NOT
// snapshotted — it tracks upstream verbatim. When upstream adds a new
// required field (e.g. hero.talkToSales, or a whole contactSales section)
// the type advances while the dictionaries stay frozen, and the next
// `next build` fails with a confusing TypeScript error at release time.
//
// This guard reads types.ts and the two dictionaries with cheap text
// parsing and fails the build (exit 1) if any TOP-LEVEL required key is
// missing from a dictionary. Top-level coverage is what bit us before
// (the entire `contactSales` section was absent in v1.5.0); nested key
// drift is still caught by the regular `next build` typecheck.
//
// Run as:
//   node scripts/check-landing-i18n.mjs

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "..");
const i18nDir = resolve(repoRoot, "apps/web/features/landing/i18n");

function read(rel) {
  return readFileSync(resolve(i18nDir, rel), "utf-8");
}

function topLevelKeysFromLandingDict(typesSrc) {
  // Locate the LandingDict type body. We intentionally avoid a full
  // TypeScript parse: this script must run with zero installed deps so it
  // can be invoked by the sync workflow before pnpm install completes.
  const start = typesSrc.indexOf("export type LandingDict = {");
  if (start === -1) {
    throw new Error("LandingDict type not found in types.ts");
  }
  // Walk braces to find the matching closing brace.
  let i = typesSrc.indexOf("{", start);
  let depth = 0;
  const bodyStart = i;
  for (; i < typesSrc.length; i += 1) {
    const c = typesSrc[i];
    if (c === "{") depth += 1;
    else if (c === "}") {
      depth -= 1;
      if (depth === 0) break;
    }
  }
  const body = typesSrc.slice(bodyStart + 1, i);
  // Top-level keys are at depth 1, indent of two spaces, followed by `:`.
  // Strip nested objects so we only see the outer keys.
  let stripped = "";
  let d = 0;
  for (const ch of body) {
    if (ch === "{") d += 1;
    if (d === 0) stripped += ch;
    if (ch === "}") d = Math.max(0, d - 1);
  }
  return [...stripped.matchAll(/^  ([a-zA-Z_][a-zA-Z0-9_]*)\??:/gm)].map(
    (m) => m[1],
  );
}

function topLevelKeysInDict(dictSrc) {
  // Dictionaries are exported as `return { header: {...}, hero: {...}, ... }`.
  // Locate the `return {` and walk to the matching brace.
  const start = dictSrc.indexOf("return {");
  if (start === -1) {
    throw new Error("`return {` not found — unexpected dict shape");
  }
  let i = dictSrc.indexOf("{", start);
  let depth = 0;
  const bodyStart = i;
  for (; i < dictSrc.length; i += 1) {
    const c = dictSrc[i];
    if (c === "{") depth += 1;
    else if (c === "}") {
      depth -= 1;
      if (depth === 0) break;
    }
  }
  const body = dictSrc.slice(bodyStart + 1, i);
  let stripped = "";
  let d = 0;
  for (const ch of body) {
    if (ch === "{") d += 1;
    if (d === 0) stripped += ch;
    if (ch === "}") d = Math.max(0, d - 1);
  }
  return [...stripped.matchAll(/^  ([a-zA-Z_][a-zA-Z0-9_]*):/gm)].map(
    (m) => m[1],
  );
}

const typesSrc = read("types.ts");
const required = topLevelKeysFromLandingDict(typesSrc);

const dicts = [
  { name: "en.ts", src: read("en.ts") },
  { name: "zh.ts", src: read("zh.ts") },
];

let ok = true;
for (const dict of dicts) {
  const present = new Set(topLevelKeysInDict(dict.src));
  const missing = required.filter((k) => !present.has(k));
  const extra = [...present].filter((k) => !required.includes(k));
  if (missing.length === 0 && extra.length === 0) {
    console.log(`✓ ${dict.name} — all ${required.length} top-level keys present`);
    continue;
  }
  ok = false;
  console.error(`✗ ${dict.name} drift detected:`);
  if (missing.length > 0) {
    console.error(`    MISSING (required by LandingDict): ${missing.join(", ")}`);
  }
  if (extra.length > 0) {
    console.error(`    EXTRA (not in LandingDict, likely stale): ${extra.join(", ")}`);
  }
}

if (!ok) {
  console.error("");
  console.error("apps/web/features/landing/i18n/{en,zh}.ts is out of sync with");
  console.error("apps/web/features/landing/i18n/types.ts. This usually means an");
  console.error("upstream merge added a new field to LandingDict that did not flow");
  console.error("into the snapshotted dictionaries (see scripts/rebrand-manifest.txt");
  console.error("and the v1.5.0 release post-mortem).");
  console.error("");
  console.error("Fix: port the new field(s) from upstream, applying the standard");
  console.error("Multica → CyberAgent rebrand (preserve x.com/MulticaAI URLs).");
  process.exit(1);
}
