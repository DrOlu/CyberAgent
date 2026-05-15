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
      {} + 2>/dev/null || true

  # zh-Hans locales: standalone "Multica" word in Chinese text — safe to
  # blanket-replace because there are no English code identifiers nearby.
  find packages/views/locales/zh-Hans -type f -name '*.json' \
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
  find apps/web -type f '(' -name '*.tsx' -o -name '*.ts' ')' \
    ! -path '*/node_modules/*' ! -path './.cyberagent-snapshot/*' \
    -exec sed -i \
      -e 's/Multica AI/CyberAgent/g' \
      -e 's/Multica Desktop/CyberAgent Desktop/g' \
      -e 's/Multica Cloud/CyberAgent Cloud/g' \
      -e 's/Multica Self-Hosted/CyberAgent Self-Hosted/g' \
      -e 's/Multica CLI/CyberAgent CLI/g' \
      {} + 2>/dev/null || true

  # ── Server Go files — prompt strings and user-visible text only.
  # NO URL or import-path rewrites here. The release-upgrade redirect to
  # DrOlu/CyberAgent in server/internal/cli/update.go is preserved via
  # the snapshot manifest.
  find server -type f -name '*.go' \
    ! -path '*/node_modules/*' ! -path './.cyberagent-snapshot/*' \
    -exec sed -i \
      -e 's|Multica platform|CyberAgent platform|g' \
      -e 's|Multica CLI|CyberAgent CLI|g' \
      -e 's|Multica Desktop|CyberAgent Desktop|g' \
      -e 's|Multica API|CyberAgent API|g' \
      -e 's|Multica AI|CyberAgent|g' \
      -e 's|Your Multica verification code|Your CyberAgent verification code|g' \
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

# ── Main ─────────────────────────────────────────────────────────────────────
case "$PHASE" in
  --restore) restore_files ;;
  --rebrand) rebrand_substitutions ;;
  all)
    restore_files
    rebrand_substitutions
    ;;
  *) echo "Usage: $0 [--restore|--rebrand|all]" >&2; exit 1 ;;
esac
