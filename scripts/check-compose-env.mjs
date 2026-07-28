#!/usr/bin/env node
/**
 * check-compose-env.mjs — Verify critical docker-compose env vars are present.
 *
 * Run in CI to catch the case where the snapshot/restore mechanism overwrites
 * docker-compose.selfhost.yml with a stale version that lacks REMOTE_API_URL.
 *
 * Without REMOTE_API_URL, the Next.js SSR proxy has no target and all API
 * calls (/api/*, /ws/*, /auth/*) are silently misrouted — causing the entire
 * CyberAgent web app to appear slow or broken on self-hosted installs.
 */
import { readFileSync } from "node:fs";

const REQUIRED = {
  "docker-compose.selfhost.yml": [
    "REMOTE_API_URL",
    "NEXT_PUBLIC_API_URL",
  ],
};

let failed = false;

for (const [file, vars] of Object.entries(REQUIRED)) {
  let content;
  try {
    content = readFileSync(file, "utf8");
  } catch {
    console.error(`ERROR: ${file} not found`);
    failed = true;
    continue;
  }
  for (const v of vars) {
    if (!content.includes(v)) {
      console.error(`ERROR: ${v} missing from ${file}`);
      console.error(
        "  This usually means the sync snapshot/restore reverted a newer" +
        " version of the file."
      );
      failed = true;
    } else {
      console.log(`OK: ${v} present in ${file}`);
    }
  }
}

if (failed) process.exit(1);
console.log("check-compose-env: all required env vars present ✅");
