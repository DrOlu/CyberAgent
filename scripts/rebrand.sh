#!/usr/bin/env bash
# rebrand.sh — Apply CyberAgent rebrand after merging upstream (multica-ai/multica).
#
# This script performs two phases:
#   1. RESTORE: Copy back CyberAgent-owned files that must NOT carry
#      upstream "Multica" branding (icons, workflows, agent config, etc.)
#   2. REBRAND: Run sed substitutions across all remaining files to replace
#      user-visible "Multica" strings with "CyberAgent" equivalents.
#      Code identifiers (binary name, package scopes, env vars, upstream URLs)
#      are intentionally preserved.
#
# Usage:
#   ./scripts/rebrand.sh              # run both phases
#   ./scripts/rebrand.sh --restore    # restore only
#   ./scripts/rebrand.sh --rebrand    # rebrand substitutions only
#
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

PHASE="${1:-all}"

# ── Phase 1: Restore CyberAgent-owned files ──────────────────────────────────
#
# These files are either binary assets (icons) or contain CyberAgent-specific
# customisations that differ structurally from upstream.  They are saved to
# .cyberagent-snapshot/ before the upstream merge and restored verbatim.
restore_files() {
  local snap=".cyberagent-snapshot"
  if [ ! -d "$snap" ]; then
    echo "::warning::No snapshot directory ($snap) — skipping restore"
    return 0
  fi

  echo "Restoring CyberAgent-specific files from snapshot..."
  # Restore all snapshot files, preserving directory structure
  rsync -a --delete "$snap/" ./
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
  # Docker images — use hardcoded drolu/ paths instead of dynamic owner
  _sed .github/workflows/release.yml 's|ghcr.io/${{ github.repository_owner }}/multica-backend|ghcr.io/drolu/cyberagent-backend|g'
  _sed .github/workflows/release.yml 's|ghcr.io/${{ github.repository_owner }}/multica-web|ghcr.io/drolu/cyberagent-web|g'
  # Docker image titles/descriptions
  _sed .github/workflows/release.yml 's/Multica Backend/CyberAgent Backend/g'
  _sed .github/workflows/release.yml 's/Multica self-hosted backend/CyberAgent self-hosted backend/g'
  _sed .github/workflows/release.yml 's/Multica Web/CyberAgent Web/g'
  _sed .github/workflows/release.yml 's/Multica self-hosted web frontend/CyberAgent self-hosted web frontend/g'
  # Remove Homebrew tap reference if upstream re-adds it
  _sed .github/workflows/release.yml '/HOMEBREW_TAP_GITHUB_TOKEN/d'
  # Comment about homebrew tap
  _sed .github/workflows/release.yml 's/publishing to$/publishing to a homebrew tap/g'
  _sed .github/workflows/release.yml 's/`multica-ai.homebrew-tap` anyway/a homebrew tap anyway/g'

  # ── GoReleaser ──────────────────────────────────────────────────────────
  _sed .goreleaser.yml 's/^project_name: multica$/project_name: cyberagent/'
  # Remove brews section (we don't publish to multica-ai/homebrew-tap)
  # This uses a multi-line approach: remove everything from "^brews:" to the
  # next top-level key or end of file.
  if grep -q '^brews:' .goreleaser.yml 2>/dev/null; then
    python3 -c "
import re, sys
text = open('.goreleaser.yml').read()
text = re.sub(r'^brews:.*(?=n)', '', text, flags=re.DOTALL | re.MULTILINE)
# Also remove trailing blank lines
text = text.rstrip() + 'n'
open('.goreleaser.yml', 'w').write(text)
"
  fi

  # ── Desktop config ─────────────────────────────────────────────────────
  _sed apps/desktop/electron-builder.yml 's/appId:.*com.multica/appId: ng.hyperspace.cyberagent/g'
  _sed apps/desktop/electron-builder.yml 's|productName: Multica|productName: CyberAgent|g'
  _sed apps/desktop/electron-builder.yml "s|protocol: multica|protocol: cyberagent|g"
  _sed apps/desktop/package.json '"name": "Multica"' '"name": "CyberAgent"'
  _sed apps/desktop/package.json '"productId":.*"com.multica"' '"productId": "ng.hyperspace.cyberagent"'

  # ── package.json (root) ─────────────────────────────────────────────────
  # Only replace the top-level "name" if it's "multica"
  _sed package.json '"name": "multica"' '"name": "cyberagent"'

  # ── Docker compose ─────────────────────────────────────────────────────
  _sed docker-compose.yml 's|ghcr.io/multica-ai/multica-backend|ghcr.io/drolu/cyberagent-backend|g'
  _sed docker-compose.yml 's|ghcr.io/multica-ai/multica-web|ghcr.io/drolu/cyberagent-web|g'
  _sed docker-compose.selfhost.yml 's|ghcr.io/multica-ai/multica-backend|ghcr.io/drolu/cyberagent-backend|g'
  _sed docker-compose.selfhost.yml 's|ghcr.io/multica-ai/multica-web|ghcr.io/drolu/cyberagent-web|g'

  # ── LICENSE author ─────────────────────────────────────────────────────
  _sed LICENSE 's/Copyright.*Multica/Copyright Hyperspace Technologies/g' || true

  # ── Docs and Markdown — broad user-visible replacements ─────────────────
  # These are safe because in .md/.mdx files "Multica" is always user-visible
  find . -type f '(' -name '*.md' -o -name '*.mdx' ')' ! -path './.git/*' ! -path './node_modules/*' ! -path './.cyberagent-snapshot/*' -print0 | xargs -0 sed -i '' '
    s/Multica AI/CyberAgent/g
    s/Multica CLI/CyberAgent CLI/g
    s/Multica platform/CyberAgent platform/g
    s/Multica Cloud/CyberAgent Cloud/g
    s/Multica Self-Hosted/CyberAgent Self-Hosted/g
    s/Multica Docs/CyberAgent Docs/g
    s/Multica Desktop/CyberAgent Desktop/g
    s/The Multica/The CyberAgent/g
    s/the Multica/the CyberAgent/g
    s/in Multica/in CyberAgent/g
    s/to Multica/to CyberAgent/g
    s/for Multica/for CyberAgent/g
    s/on Multica/on CyberAgent/g
    s/of Multica/of CyberAgent/g
    s/with Multica/with CyberAgent/g
    s/from Multica/from CyberAgent/g
    s/by Multica/by CyberAgent/g
    s/your Multica/your CyberAgent/g
    s/using Multica/using CyberAgent/g
    s/A Multica/A CyberAgent/g
    s|multica-ai/multica|DrOlu/CyberAgent|g
    s|multica.ai|cyberagent.sh|g
  ' 2>/dev/null || true

  # ── Locales / i18n JSON ────────────────────────────────────────────────
  find . -type f -name '*.json' ! -path './.git/*' ! -path './node_modules/*' ! -path './.cyberagent-snapshot/*' -print0 | xargs -0 sed -i '' '
    s/"Multica"/"CyberAgent"/g
    s/Multica AI/CyberAgent/g
    s/Multica Cloud/CyberAgent Cloud/g
    s|multica.ai|cyberagent.sh|g
  ' 2>/dev/null || true

  # ── Web app — user-visible strings ─────────────────────────────────────
  _sed apps/web/app/layout.tsx 's/Multica/CyberAgent/g' 2>/dev/null || true
  _sed apps/web/app/custom.css 's/Multica/CyberAgent/g' 2>/dev/null || true
  _sed apps/web/app/not-found.tsx 's/Multica/CyberAgent/g' 2>/dev/null || true

  # Landing pages (user-facing)
  find apps/web -type f '(' -name '*.tsx' -o -name '*.ts' ')' ! -path '*/node_modules/*' ! -path './.cyberagent-snapshot/*' -print0 | xargs -0 sed -i '' '
    s/Multica AI/CyberAgent/g
    s/Multica Desktop/CyberAgent Desktop/g
    s/Multica Cloud/CyberAgent Cloud/g
    s/Multica Self-Hosted/CyberAgent Self-Hosted/g
    s/Multica CLI/CyberAgent CLI/g
    s|multica.ai|cyberagent.sh|g
    s|multica-ai/multica|DrOlu/CyberAgent|g
  ' 2>/dev/null || true

  # ── Server Go files — prompt strings and user-visible text ──────────────
  # Only replace user-facing strings in Go (NOT code identifiers like package
  # names, struct fields, import paths)
  find server -type f -name '*.go' ! -path '*/node_modules/*' ! -path './.cyberagent-snapshot/*' -print0 | xargs -0 sed -i '' '
    s|Multica platform|CyberAgent platform|g
    s|Multica CLI|CyberAgent CLI|g
    s|Multica AI|CyberAgent|g
    s|multica.ai|cyberagent.sh|g
    s|multica-ai/multica|DrOlu/CyberAgent|g
  ' 2>/dev/null || true

  # ── Desktop renderer / main process — user-visible strings ────────────
  find apps/desktop/src -type f '(' -name '*.ts' -o -name '*.tsx' -o -name '*.html' ')' ! -path '*/node_modules/*' -print0 | xargs -0 sed -i '' '
    s|Multica Desktop|CyberAgent Desktop|g
    s/CyberAgent Desktop App/CyberAgent Desktop/g
    s|multica://|cyberagent://|g
    s|multica-ai/multica|DrOlu/CyberAgent|g
  ' 2>/dev/null || true

  # ── Styles (CSS) ───────────────────────────────────────────────────────
  find . -type f -name '*.css' ! -path './.git/*' ! -path './node_modules/*' ! -path './.cyberagent-snapshot/*' -print0 | xargs -0 sed -i '' '
    s/Multica/CyberAgent/g
  ' 2>/dev/null || true

  # ── Install scripts ───────────────────────────────────────────────────
  _sed scripts/install.sh 's|multica-ai/multica|DrOlu/CyberAgent|g' 2>/dev/null || true
  _sed scripts/install.ps1 's|multica-ai/multica|DrOlu/CyberAgent|g' 2>/dev/null || true

  echo "Rebrand substitutions complete."
}

# ── Helper: portable in-place sed ─────────────────────────────────────────────
_sed() {
  local file="$1" pattern="$2" replacement="$3"
  if [ ! -f "$file" ]; then return 0; fi
  # macOS sed -i '' (BSD) vs GNU sed -i
  if sed --version 2>/dev/null | grep -q GNU; then
    sed -i "$pattern" "$replacement" "$file" 2>/dev/null || true
  else
    sed -i '' "$pattern" "$replacement" "$file" 2>/dev/null || true
  fi
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
