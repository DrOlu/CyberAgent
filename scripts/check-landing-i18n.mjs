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
// Since the upstream landing redesign, the dictionaries open with a
// one-level object spread (`...enSiteCopy`) that pulls the site / home /
// demo / meta copy from sibling modules (site-en.ts, which itself pulls
// demo-en.ts). This guard resolves those spreads (one level, by the
// <locale>SiteCopy → site-<locale>.ts convention) so top-level coverage is
// still validated against the real composition.
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

// Locate `anchor` in src, then walk braces to find the matching closing
// brace and return the object body. We intentionally avoid a full
// TypeScript parse: this script must run with zero installed deps so it
// can be invoked by the sync workflow before pnpm install completes.
function objectBodyAfter(src, anchor) {
  const start = src.indexOf(anchor);
  if (start === -1) {
    throw new Error(`anchor not found: ${JSON.stringify(anchor)}`);
  }
  let i = src.indexOf("{", start);
  let depth = 0;
  const bodyStart = i;
  for (; i < src.length; i += 1) {
    const c = src[i];
    if (c === "{") depth += 1;
    else if (c === "}") {
      depth -= 1;
      if (depth === 0) break;
    }
  }
  return src.slice(bodyStart + 1, i);
}

// Top-level keys sit at an indent of two spaces followed by `:` (or `?:`
// in type position). Strip nested objects so we only see the outer keys.
function topLevelKeysOfObjectBody(body) {
  let stripped = "";
  let d = 0;
  for (const ch of body) {
    if (ch === "{") d += 1;
    if (d === 0) stripped += ch;
    if (ch === "}") d = Math.max(0, d - 1);
  }
  return [
    ...stripped.matchAll(/^  ([a-zA-Z_][a-zA-Z0-9_]*)\??:/gm),
  ].map((m) => m[1]);
}

function topLevelKeysFromLandingDict(typesSrc) {
  const body = objectBodyAfter(typesSrc, "export type LandingDict = {");
  return topLevelKeysOfObjectBody(body);
}

// Resolve one-level object spreads in a dictionary's return body, e.g.
// `  ...enSiteCopy,`. The site/home/demo/meta copy lives in sibling
// modules since the upstream landing redesign; spread keys count as
// present so the guardrail validates the real composition.
function spreadKeysInDict(dictSrc, dictName) {
  const spreads = [
    ...dictSrc.matchAll(/^  \.\.\.([a-zA-Z_][a-zA-Z0-9_]*)\s*,?[ \t]*$/gm),
  ].map((m) => m[1]);
  const keys = [];
  for (const id of spreads) {
    // Convention: <locale>SiteCopy is exported from site-<locale>.ts.
    const m = id.match(/^([a-z]{2})SiteCopy$/);
    if (!m) {
      console.error(
        `! ${dictName}: spread ${id} does not match the <locale>SiteCopy convention — keys not counted`,
      );
      continue;
    }
    let siteSrc;
    try {
      siteSrc = read(`site-${m[1]}.ts`);
    } catch {
      console.error(
        `! ${dictName}: cannot read site-${m[1]}.ts for spread ${id}`,
      );
      continue;
    }
    try {
      const body = objectBodyAfter(siteSrc, `export const ${id}`);
      keys.push(...topLevelKeysOfObjectBody(body));
    } catch (e) {
      console.error(`! ${dictName}: failed to parse spread ${id}: ${e.message}`);
    }
  }
  return keys;
}

function topLevelKeysInDict(dictSrc, dictName) {
  // Dictionaries are exported as `return { ...xxSiteCopy, faq: {...}, ... }`.
  const body = objectBodyAfter(dictSrc, "return {");
  return [
    ...topLevelKeysOfObjectBody(body),
    ...spreadKeysInDict(dictSrc, dictName),
  ];
}

const typesSrc = read("types.ts");
const required = topLevelKeysFromLandingDict(typesSrc);

const dicts = [
  { name: "en.ts", src: read("en.ts") },
  { name: "zh.ts", src: read("zh.ts") },
];

let ok = true;
for (const dict of dicts) {
  const present = new Set(topLevelKeysInDict(dict.src, dict.name));
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
  console.error("Since the landing redesign, site/home/demo/meta copy lives in the");
  console.error("snapshotted site-<locale>.ts / demo-<locale>.ts modules that the");
  console.error("dictionaries spread in — update those too when upstream moves keys.");
  process.exit(1);
}
