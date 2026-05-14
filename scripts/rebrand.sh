#!/usr/bin/env bash
# rebrand.sh — Apply CyberAgent rebrand after merging upstream (multica-ai/multica).
#
# Two phases:
#   1. RESTORE: Copy back CyberAgent-owned files from .cyberagent-snapshot/
#   2. REBRAND: Run sed substitutions to replace user-visible "Multica" strings
#      with "CyberAgent" equivalents. Code identifiers (binary name, package
#      scopes, env vars, upstream URLs) are intentionally preserved.
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
# Usage: _sed <file> <sed-expression>
#   e.g.  _sed file.yml 's/Multica/CyberAgent/g'
#         _sed file.yml '/HOMEBREW_TAP_GITHUB_TOKEN/d'
_sed() {
  local file="$1" expr="$2"
  [ -f "$file" ] || return 0
  sed -i "$expr" "$file" 2>/dev/null || true
}

# ── Phase 1: Restore CyberAgent-owned files ──────────────────────────────────
#
# Files listed in scripts/rebrand-manifest.txt are snapshotted before the
# upstream merge and restored verbatim afterwards. This ensures our branding
# never gets overwritten by upstream content.
restore_files() {
  local snap=".cyberagent-snapshot"
  if [ ! -d "$snap" ]; then
    echo "::warning::No snapshot directory ($snap) — skipping restore"
    return 0
  fi

  echo "Restoring CyberAgent-specific files from snapshot..."
  # Restore all snapshot files, preserving directory structure.
  # --no-implied-dirs: don't delete files that aren't in the snapshot.
  # Exit code 24 = "some files vanished" — harmless in CI.
  rsync -a --no-implied-dirs "$snap/" ./ || [ $? -eq 24 ]
  echo "Restore complete."
}

# ── Phase 2: Sed-based rebrand substitutions ─────────────────────────────────
#
# These patterns cover all user-visible strings changed during the original
# CyberAgent rebrand.  Code identifiers are EXCLUDED on purpose:
#   - binary name: multica  (GoReleaser builds `multica`)
#   - package scope: @multica/*
#   - env vars: MULTICA_*
#   - upstream URLs: multica-ai, multica.ai, MulticaAI
#   - component names: MulticaIcon  (code identifier, not user-visible)
#
rebrand_substitutions() {
  echo "Applying CyberAgent rebrand substitutions..."

  # ── Workflow fixes ──────────────────────────────────────────────────────
  # ci.yml — Postgres credentials
  _sed .github/workflows/ci.yml 's/POSTGRES_DB: multica/POSTGRES_DB: cyberagent/g'
  _sed .github/workflows/ci.yml 's/POSTGRES_USER: multica/POSTGRES_USER: cyberagent/g'
  _sed .github/workflows/ci.yml 's/POSTGRES_PASSWORD: multica/POSTGRES_PASSWORD: cyberagent/g'
  _sed .github/workflows/ci.yml 's/pg_isready -U multica -d multica/pg_isready -U cyberagent -d cyberagent/g'
  _sed .github/workflows/ci.yml 's|postgres://multica:multica@|postgres://cyberagent:cyberagent@|g'

  # release.yml — Owner guard, Docker image names, Homebrew removal
  _sed .github/workflows/release.yml "s/github.repository_owner == 'multica-ai'/github.repository_owner == 'DrOlu'/g"
  _sed .github/workflows/release.yml 's|ghcr.io/${{ github.repository_owner }}/multica-backend|ghcr.io/drolu/cyberagent-backend|g'
  _sed .github/workflows/release.yml 's|ghcr.io/${{ github.repository_owner }}/multica-web|ghcr.io/drolu/cyberagent-web|g'
  _sed .github/workflows/release.yml 's/Multica Backend/CyberAgent Backend/g'
  _sed .github/workflows/release.yml 's/Multica self-hosted backend/CyberAgent self-hosted backend/g'
  _sed .github/workflows/release.yml 's/Multica Web/CyberAgent Web/g'
  _sed .github/workflows/release.yml 's/Multica self-hosted web frontend/CyberAgent self-hosted web frontend/g'
  # Remove Homebrew tap secret reference if upstream re-adds it
  _sed .github/workflows/release.yml '/HOMEBREW_TAP_GITHUB_TOKEN/d'

  # ── GoReleaser ──────────────────────────────────────────────────────────
  _sed .goreleaser.yml 's/^project_name: multica$/project_name: cyberagent/'
  # Remove brews section (we don't publish to multica-ai/homebrew-tap)
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

  # ── Docker compose ─────────────────────────────────────────────────────
  _sed docker-compose.yml 's|ghcr.io/multica-ai/multica-backend|ghcr.io/drolu/cyberagent-backend|g'
  _sed docker-compose.yml 's|ghcr.io/multica-ai/multica-web|ghcr.io/drolu/cyberagent-web|g'
  _sed docker-compose.selfhost.yml 's|ghcr.io/multica-ai/multica-backend|ghcr.io/drolu/cyberagent-backend|g'
  _sed docker-compose.selfhost.yml 's|ghcr.io/multica-ai/multica-web|ghcr.io/drolu/cyberagent-web|g'

  # ── LICENSE author ─────────────────────────────────────────────────────
  _sed LICENSE 's/Copyright.*Multica/Copyright Hyperspace Technologies/g' || true

  # ── Docs and Markdown — broad user-visible replacements ─────────────────
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
      -e 's|multica.ai|cyberagent.sh|g' \
      {} + 2>/dev/null || true

  # ── Locales / i18n JSON ────────────────────────────────────────────────
  find . -type f -name '*.json' \
    ! -path './.git/*' ! -path './node_modules/*' ! -path './.cyberagent-snapshot/*' \
    -exec sed -i \
      -e 's/"Multica"/"CyberAgent"/g' \
      -e 's/Multica AI/CyberAgent/g' \
      -e 's/Multica Cloud/CyberAgent Cloud/g' \
      -e 's|multica.ai|cyberagent.sh|g' \
      {} + 2>/dev/null || true

  # ── Web app — user-visible strings ─────────────────────────────────────
  _sed apps/web/app/layout.tsx 's/Multica/CyberAgent/g' 2>/dev/null || true
  _sed apps/web/app/custom.css 's/Multica/CyberAgent/g' 2>/dev/null || true
  _sed apps/web/app/not-found.tsx 's/Multica/CyberAgent/g' 2>/dev/null || true

  # Landing pages (user-facing)
  find apps/web -type f '(' -name '*.tsx' -o -name '*.ts' ')' \
    ! -path '*/node_modules/*' ! -path './.cyberagent-snapshot/*' \
    -exec sed -i \
      -e 's/Multica AI/CyberAgent/g' \
      -e 's/Multica Desktop/CyberAgent Desktop/g' \
      -e 's/Multica Cloud/CyberAgent Cloud/g' \
      -e 's/Multica Self-Hosted/CyberAgent Self-Hosted/g' \
      -e 's/Multica CLI/CyberAgent CLI/g' \
      -e 's|multica.ai|cyberagent.sh|g' \
      {} + 2>/dev/null || true

  # ── Server Go files — prompt strings and user-visible text ──────────────
  find server -type f -name '*.go' \
    ! -path '*/node_modules/*' ! -path './.cyberagent-snapshot/*' \
    -exec sed -i \
      -e 's|Multica platform|CyberAgent platform|g' \
      -e 's|Multica CLI|CyberAgent CLI|g' \
      -e 's|Multica AI|CyberAgent|g' \
      {} + 2>/dev/null || true

  # ── Desktop renderer / main process — user-visible strings ────────────
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

  # ── Install scripts ───────────────────────────────────────────────────

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