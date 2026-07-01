#!/usr/bin/env bash
# rebrand.sh — Apply CyberAgent rebrand after merging upstream (multica-ai/multica).
#
# POLICY (very important):
#   FUNCTIONAL URLs stay as upstream Multica URLs. Examples:
#     - api.multica.ai, multica.ai, www.multica.ai (CLI server endpoints, web app)
#     - github.com/multica-ai/multica (Go import paths, GH issue references)
#     - multica-ai/tap/multica (Homebrew tap)
#     - test fixture emails @multica.ai
#     - environment variables: MULTICA_*
#     - upstream package scopes: @multica/*
#     - binary name: multica
#
#   ONLY upgrade-path / publishing endpoints point to DrOlu/CyberAgent:
#     - GitHub Releases API (FetchLatestRelease) — handled directly in
#       server/internal/cli/update.go via snapshot, NOT via sed here.
#     - Docker images we publish (ghcr.io/drolu/cyberagent-*) — handled in
#       docker-compose.selfhost.yml via snapshot.
#
#   USER-VISIBLE BRAND NAME: "Multica" → "CyberAgent" in display strings only.
#     We carefully scope this so it never touches functional URLs, code
#     identifiers, or import paths. Any pattern below that includes a "."
#     MUST escape it (\.) to avoid matching "multica-ai".
#
# Two phases:
#   1. RESTORE: Copy back CyberAgent-owned files from .cyberagent-snapshot/
#   2. REBRAND: Run sed substitutions to replace user-visible "Multica" strings
#      with "CyberAgent" equivalents.
#
# Usage:
#   ./scripts/rebrand.sh              # run both phases
#   ./scripts/rebrand.sh --restore    # restore only
#   ./scripts/rebrand.sh --rebrand    # rebrand substitutions only
#
set -uo pipefail
cd "$(git rev-parse --show-toplevel)"

PHASE="${1:-all}"

# ── Helper: in-place sed (GNU sed on CI, tolerates missing files) ──────────
_sed() {
  local file="$1" expr="$2"
  [ -f "$file" ] || return 0
  sed -i "$expr" "$file" 2>/dev/null || true
}

# ── Phase 1: Restore CyberAgent-owned files ──────────────────────────────────
restore_files() {
  local snap=".cyberagent-snapshot"
  if [ ! -d "$snap" ]; then
    echo "::warning::No snapshot directory ($snap) — skipping restore"
    return 0
  fi

  echo "Restoring CyberAgent-specific files from snapshot..."
  rsync -a --no-implied-dirs "$snap/" ./ || [ $? -eq 24 ]
  echo "Restore complete."
}

# ── Phase 2: Sed-based rebrand substitutions ─────────────────────────────────
rebrand_substitutions() {
  echo "Applying CyberAgent rebrand substitutions..."

  # ── Workflow fixes (CI Postgres credentials are functional but local) ──
  _sed .github/workflows/ci.yml 's/POSTGRES_DB: multica/POSTGRES_DB: cyberagent/g'
  _sed .github/workflows/ci.yml 's/POSTGRES_USER: multica/POSTGRES_USER: cyberagent/g'
  _sed .github/workflows/ci.yml 's/POSTGRES_PASSWORD: multica/POSTGRES_PASSWORD: cyberagent/g'
  _sed .github/workflows/ci.yml 's/pg_isready -U multica -d multica/pg_isready -U cyberagent -d cyberagent/g'
  _sed .github/workflows/ci.yml 's|postgres://multica:multica@|postgres://cyberagent:cyberagent@|g'

  # release.yml — Owner guard, Docker image names, Homebrew removal
  # These are upgrade-path / publishing endpoints under DrOlu org.
  _sed .github/workflows/release.yml "s/github.repository_owner == 'multica-ai'/github.repository_owner == 'DrOlu'/g"
  _sed .github/workflows/release.yml 's|ghcr.io/${{ github.repository_owner }}/multica-backend|ghcr.io/drolu/cyberagent-backend|g'
  _sed .github/workflows/release.yml 's|ghcr.io/${{ github.repository_owner }}/multica-web|ghcr.io/drolu/cyberagent-web|g'
  _sed .github/workflows/release.yml 's/Multica Backend/CyberAgent Backend/g'
  _sed .github/workflows/release.yml 's/Multica self-hosted backend/CyberAgent self-hosted backend/g'
  _sed .github/workflows/release.yml 's/Multica Web/CyberAgent Web/g'
  _sed .github/workflows/release.yml 's/Multica self-hosted web frontend/CyberAgent self-hosted web frontend/g'
  _sed .github/workflows/release.yml '/HOMEBREW_TAP_GITHUB_TOKEN/d'

  # ── GoReleaser ──────────────────────────────────────────────────────────
  _sed .goreleaser.yml 's/^project_name: multica$/project_name: cyberagent/'
  if grep -q '^brews:' .goreleaser.yml 2>/dev/null; then
    python3 -c "
import re
text = open('.goreleaser.yml').read()
text = re.sub(r'\nbrews:.*', '', text, flags=re.DOTALL)
text = text.rstrip() + '\n'
open('.goreleaser.yml', 'w').write(text)
"
  fi

  # ── Desktop config ─────────────────────────────────────────────────────
  _sed apps/desktop/electron-builder.yml 's/appId:.*com.multica/appId: ng.hyperspace.cyberagent/g'
  _sed apps/desktop/electron-builder.yml 's|productName: Multica|productName: CyberAgent|g'
  _sed apps/desktop/electron-builder.yml 's|protocol: multica|protocol: cyberagent|g'
  _sed apps/desktop/package.json 's/"name": "Multica"/"name": "CyberAgent"/g'
  _sed apps/desktop/package.json 's/"productId":.*"com.multica"/"productId": "ng.hyperspace.cyberagent"/g'

  # ── package.json (root) ─────────────────────────────────────────────────
  _sed package.json 's/"name": "multica"/"name": "cyberagent"/g'

  # ── Docker compose — only the self-hosted file points to our published
  #    images (drolu/cyberagent-*). Everything else is left alone.
  _sed docker-compose.selfhost.yml 's|ghcr.io/multica-ai/multica-backend|ghcr.io/drolu/cyberagent-backend|g'
  _sed docker-compose.selfhost.yml 's|ghcr.io/multica-ai/multica-web|ghcr.io/drolu/cyberagent-web|g'

  # ── LICENSE author ─────────────────────────────────────────────────────
  _sed LICENSE 's/Copyright.*Multica/Copyright Hyperspace Technologies/g' || true

  # ── Docs and Markdown — broad user-visible replacements ─────────────────
  # NOTE: NO multica.ai → cyberagent.sh substitution here. Functional URLs
  # in docs (api.multica.ai, multica.ai) stay as-is. Only the brand name
  # itself is rewritten in display contexts.
  find . -type f '(' -name '*.md' -o -name '*.mdx' ')' \
    ! -path './.git/*' ! -path './node_modules/*' ! -path './.cyberagent-snapshot/*' \
    -exec sed -i \
      -e 's/Multica AI/CyberAgent/g' \
      -e 's/Multica CLI/CyberAgent CLI/g' \
      -e 's/Multica platform/CyberAgent platform/g' \
      -e 's/Multica Cloud/CyberAgent Cloud/g' \
      -e 's/Multica Self-Hosted/CyberAgent Self-Hosted/g' \
      -e 's/Multica Docs/CyberAgent Docs/g' \
      -e 's/Multica Desktop/CyberAgent Desktop/g' \
      -e 's/The Multica/The CyberAgent/g' \
      -e 's/the Multica/the CyberAgent/g' \
      -e 's/in Multica/in CyberAgent/g' \
      -e 's/to Multica/to CyberAgent/g' \
      -e 's/for Multica/for CyberAgent/g' \
      -e 's/on Multica/on CyberAgent/g' \
      -e 's/of Multica/of CyberAgent/g' \
      -e 's/with Multica/with CyberAgent/g' \
      -e 's/from Multica/from CyberAgent/g' \
      -e 's/by Multica/by CyberAgent/g' \
      -e 's/your Multica/your CyberAgent/g' \
      -e 's/using Multica/using CyberAgent/g' \
      -e 's/A Multica/A CyberAgent/g' \
      {} + 2>/dev/null || true

  # ── Locales / i18n JSON — brand-name only, no URL substitution ──────────
  find packages/views/locales -type f -name '*.json' \
    -exec sed -i \
      -e 's/"Multica"/"CyberAgent"/g' \
      -e 's/Multica AI/CyberAgent/g' \
      -e 's/Multica Cloud/CyberAgent Cloud/g' \
      -e 's/Multica Desktop/CyberAgent Desktop/g' \
      -e 's/Multica Self-Hosted/CyberAgent Self-Hosted/g' \
      -e 's/the Multica/the CyberAgent/g' \
      -e 's/The Multica/The CyberAgent/g' \
      -e 's/in Multica/in CyberAgent/g' \
      -e 's/from Multica/from CyberAgent/g' \
      -e 's/with Multica/with CyberAgent/g' \
      -e 's/to Multica/to CyberAgent/g' \
      -e 's/of Multica/of CyberAgent/g' \
      -e 's/by Multica/by CyberAgent/g' \
      -e 's/on Multica/on CyberAgent/g' \
      -e 's/for Multica/for CyberAgent/g' \
      -e 's/your Multica/your CyberAgent/g' \
      -e 's/when Multica/when CyberAgent/g' \
      -e 's/uses Multica/uses CyberAgent/g' \
      -e 's/run Multica/run CyberAgent/g' \
      -e 's/access Multica/access CyberAgent/g' \
      -e 's/Opening Multica/Opening CyberAgent/g' \
      -e 's/"Multica is working/"CyberAgent is working/g' \
      -e 's/"Ask Multica"/"Ask CyberAgent"/g' \
      -e 's/Let Multica know/Let CyberAgent know/g' \
      -e 's/Multica knows/CyberAgent knows/g' \
      -e 's/Multica drives/CyberAgent drives/g' \
      -e 's/Welcome to Multica/Welcome to CyberAgent/g' \
      -e 's/about Multica/about CyberAgent/g' \
      -e 's/use Multica/use CyberAgent/g' \
      -e 's/Install the Multica CLI/Install the CyberAgent CLI/g' \
      -e 's/Multica will generate/CyberAgent will generate/g' \
      -e 's/inside Multica/inside CyberAgent/g' \
      -e 's/connect to Multica/connect to CyberAgent/g' \
      -e 's/Multica CLI/CyberAgent CLI/g' \
      -e 's/Multica Helper/CyberAgent Helper/g' \
      {} + 2>/dev/null || true

  # zh-Hans locales: standalone "Multica" word in Chinese text — safe to
  # blanket-replace because there are no English code identifiers nearby.
  find packages/views/locales/zh-Hans -type f -name '*.json' \
    -exec sed -i 's/Multica/CyberAgent/g' {} + 2>/dev/null || true

  # ── Onboarding starter content (TS files with template literals that
  #    render directly into user-visible issue descriptions). These hold
  #    the "Welcome to Multica" / "Agents in Multica are triggered..." etc.
  #    strings that ship as the first-run guided issues. Brand name only;
  #    URLs (https://multica.ai/docs/...) remain functional.
  find packages/views/onboarding -type f -name '*.ts' \
    ! -path '*/node_modules/*' \
    -exec sed -i \
      -e 's/Welcome to Multica/Welcome to CyberAgent/g' \
      -e 's/about Multica/about CyberAgent/g' \
      -e 's/use Multica/use CyberAgent/g' \
      -e 's/in Multica/in CyberAgent/g' \
      -e 's/inside Multica/inside CyberAgent/g' \
      -e 's/from Multica/from CyberAgent/g' \
      -e 's/using Multica/using CyberAgent/g' \
      -e 's/with Multica/with CyberAgent/g' \
      -e 's/connect to Multica/connect to CyberAgent/g' \
      -e 's/Multica works best/CyberAgent works best/g' \
      -e 's/How Multica triggers/How CyberAgent triggers/g' \
      -e 's/Agents in Multica/Agents in CyberAgent/g' \
      -e 's/Multica! 👋/CyberAgent! 👋/g' \
      -e 's/Multica — let/CyberAgent — let/g' \
      -e 's/欢迎来到 Multica/欢迎来到 CyberAgent/g' \
      -e 's/Multica 里/CyberAgent 里/g' \
      -e 's/Multica 的/CyberAgent 的/g' \
      -e 's/Multica 中/CyberAgent 中/g' \
      -e 's/用 Multica/用 CyberAgent/g' \
      -e 's/在 Multica/在 CyberAgent/g' \
      -e 's/Multica 能/CyberAgent 能/g' \
      -e 's/Multica。/CyberAgent。/g' \
      -e 's/Multica ——/CyberAgent ——/g' \
      {} + 2>/dev/null || true

  # ── Test files in packages/views that assert on rebranded i18n strings ──
  # The locale JSON sed pass above rewrites user-visible copy
  # ("Welcome to Multica" → "Welcome to CyberAgent" etc.). Tests rendered
  # through React Testing Library look up that same copy via getByText,
  # so the brand-name expectations in test regexes must follow. We restrict
  # the substitutions to the same narrow set used for JSON locales above —
  # NOT a blanket 'Multica' rewrite — so identifiers like the
  # "Multica Helper" agent-name constant (defined in
  # packages/views/workspace/welcome-after-onboarding.tsx and asserted as a
  # literal string) stay intact.
  find packages/views -type f '(' -name '*.test.ts' -o -name '*.test.tsx' ')' \
    ! -path '*/node_modules/*' \
    -exec sed -i \
      -e 's|Welcome to Multica|Welcome to CyberAgent|g' \
      -e 's|welcome to Multica|welcome to CyberAgent|g' \
      -e 's|hear about Multica|hear about CyberAgent|g' \
      {} + 2>/dev/null || true

  # ── Go server tests — patch brand-name string literals in test assertions.
  #    The server runtime injects "CyberAgent Agent Runtime" (rebranded from
  #    "Multica Agent Runtime") into agent config files. Go tests that assert
  #    on this string must check for the rebranded value, not the upstream one.
  #    We restrict to the specific string to avoid touching functional identifiers.
  find server -type f -name '*_test.go' \
    ! -path '*/node_modules/*' \
    -exec sed -i \
      -e 's|Multica Agent Runtime|CyberAgent Agent Runtime|g' \
      {} + 2>/dev/null || true


  # ── Docs site (.mdx) — CyberAgent's docs site (apps/docs/), so any
  #    "Multica" brand reference here is user-visible. URLs stay as-is
  #    (the .mdx files don't contain functional multica.ai URLs anyway,
  #    they use relative paths like /cli, /agents). Blanket replace is
  #    safe because there are no code identifiers in .mdx prose.
  find apps/docs/content -type f '(' -name '*.mdx' -o -name '*.md' ')' \
    -exec sed -i 's/Multica/CyberAgent/g' {} + 2>/dev/null || true

  # Feedback modal hint: upstream points users to "GitHub" for issues; we
  # point them to CyberAgent (cyberagent.ng) instead. The link href itself
  # lives in packages/views/modals/feedback.tsx (snapshotted); these two
  # sed rules rewrite the surrounding link text + lead-in across locales.
  _sed packages/views/locales/en/modals.json 's/"github_hint_link": "GitHub"/"github_hint_link": "CyberAgent"/'
  _sed packages/views/locales/en/modals.json 's/"github_hint_prefix": "Want faster handling and open discussion? Head to "/"github_hint_prefix": "Want faster handling and open discussion? Visit "/'
  _sed packages/views/locales/zh-Hans/modals.json 's/"github_hint_link": "GitHub"/"github_hint_link": "CyberAgent"/'
  _sed packages/views/locales/zh-Hans/modals.json 's/"github_hint_prefix": "想被更快处理、参与讨论？请去 "/"github_hint_prefix": "想被更快处理、参与讨论？请访问 "/'

  # ── Web app — user-visible strings (snapshotted files only restore brand)
  _sed apps/web/app/layout.tsx 's/Multica/CyberAgent/g' 2>/dev/null || true
  _sed apps/web/app/custom.css 's/Multica/CyberAgent/g' 2>/dev/null || true
  _sed apps/web/app/not-found.tsx 's/Multica/CyberAgent/g' 2>/dev/null || true

  # Landing pages (user-facing). NO URL rewriting — multica.ai stays.
  # Twitter handle https://x.com/MulticaAI is intentionally untouched
  # (functional account, owned by upstream brand). We rebrand only the
  # surrounding display text.
  find apps/web -type f '(' -name '*.tsx' -o -name '*.ts' ')' \
    ! -path '*/node_modules/*' ! -path './.cyberagent-snapshot/*' \
    -exec sed -i \
      -e 's/Multica AI/CyberAgent/g' \
      -e 's/Multica Desktop/CyberAgent Desktop/g' \
      -e 's/Multica Cloud/CyberAgent Cloud/g' \
      -e 's/Multica Self-Hosted/CyberAgent Self-Hosted/g' \
      -e 's/Multica CLI/CyberAgent CLI/g' \
      -e 's/inside Multica/inside CyberAgent/g' \
      -e 's/在 Multica/在 CyberAgent/g' \
      {} + 2>/dev/null || true

  # Landing header: the brand wordmark is rendered as the lowercase JSX
  # text "multica" on a line by itself (see apps/web/features/landing/
  # components/landing-header.tsx). We can't put this file in the snapshot
  # manifest because upstream actively redesigns the header (nav links,
  # mobile drawer, type-shape churn) and a stale snapshot breaks the
  # TypeScript build. Instead we let upstream's file flow through and
  # rewrite only the wordmark line here.
  #
  # The whole-line anchors (^...$) are deliberate: this pattern must NOT
  # match the @multica/* import specifiers on lines 6-8 of the same file,
  # nor any other "multica" occurrence in URLs, comments, or identifiers.
  _sed apps/web/features/landing/components/landing-header.tsx \
    's/^\([[:space:]]*\)multica$/\1cyberagent/'

  # ── Server Go files — prompt strings and user-visible text only.
  # NO URL or import-path rewrites here. The release-upgrade redirect to
  # DrOlu/CyberAgent in server/internal/cli/update.go is preserved via
  # the snapshot manifest.
  find server -type f -name '*.go' \
    ! -path '*/node_modules/*' ! -path './.cyberagent-snapshot/*' \
    -exec sed -i \
      -e 's|Multica Agent Runtime|CyberAgent Agent Runtime|g' \
      -e 's|Multica platform|CyberAgent platform|g' \
      -e 's|Multica CLI|CyberAgent CLI|g' \
      -e 's|Multica Desktop|CyberAgent Desktop|g' \
      -e 's|Multica API|CyberAgent API|g' \
      -e 's|Multica AI|CyberAgent|g' \
      -e 's|Your Multica verification code|Your CyberAgent verification code|g' \
      -e 's|open Multica resource URLs|open CyberAgent resource URLs|g' \
      -e 's|Log in to Multica|Log in to CyberAgent|g' \
      -e 's|Logged in to Multica|Logged in to CyberAgent|g' \
      {} + 2>/dev/null || true

  # ── Desktop renderer / main process — user-visible strings + protocol ──
  # The cyberagent:// protocol is part of the desktop app identity (deep
  # links into our installed app), not a functional server URL.
  find apps/desktop/src -type f '(' -name '*.ts' -o -name '*.tsx' -o -name '*.html' ')' \
    ! -path '*/node_modules/*' \
    -exec sed -i \
      -e 's|Multica Desktop|CyberAgent Desktop|g' \
      -e 's|Multica Desktop App|CyberAgent Desktop|g' \
      -e 's|multica://|cyberagent://|g' \
      {} + 2>/dev/null || true

  # ── Styles (CSS) ───────────────────────────────────────────────────────
  find . -type f -name '*.css' \
    ! -path './.git/*' ! -path './node_modules/*' ! -path './.cyberagent-snapshot/*' \
    -exec sed -i 's/Multica/CyberAgent/g' {} + 2>/dev/null || true

  echo "Rebrand substitutions complete."
}

# ── Phase 3: Reconcile apps/desktop/package.json ─────────────────────────────
# This file is INTENTIONALLY NOT snapshotted so upstream's dep changes flow
# through every sync. Only the 3 brand-identity fields need overwriting.
# Using node (already on CI) for JSON-safe edits — never sed on JSON.
reconcile_desktop_pkg() {
  local pkg="apps/desktop/package.json"
  if [ ! -f "$pkg" ]; then
    echo "::warning::$pkg not found — skipping reconcile"
    return 0
  fi
  if ! command -v node >/dev/null 2>&1; then
    echo "::warning::node not available — skipping desktop package.json reconcile"
    return 0
  fi

  echo "Reconciling brand fields in $pkg..."
  node -e '
    const fs = require("node:fs");
    const path = "apps/desktop/package.json";
    const pkg = JSON.parse(fs.readFileSync(path, "utf8"));

    // Brand-only overrides. If upstream renames any of these keys, the
    // override is harmlessly added as a new key — we never drop upstream
    // fields, we only overwrite these three.
    pkg.productName = "CyberAgent";
    pkg.description = "CyberAgent Desktop — native desktop client for the CyberAgent platform.";
    pkg.homepage = "https://github.com/DrOlu/CyberAgent";

    fs.writeFileSync(path, JSON.stringify(pkg, null, 2) + "\n");
    console.log("[reconcile_desktop_pkg] applied: productName, description, homepage");
  '
}

# ── Main ─────────────────────────────────────────────────────────────────────
case "$PHASE" in
  --restore) restore_files ;;
  --rebrand) rebrand_substitutions ;;
  --reconcile-desktop-pkg) reconcile_desktop_pkg ;;
  all)
    restore_files
    rebrand_substitutions
    reconcile_desktop_pkg
    ;;
  *) echo "Usage: $0 [--restore|--rebrand|--reconcile-desktop-pkg|all]" >&2; exit 1 ;;
esac
