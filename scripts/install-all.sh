#!/usr/bin/env bash
# ============================================================
# install-all.sh — Install every SK* package in editable mode
# ============================================================
# Usage:
#   bash scripts/install-all.sh          # Install all
#   bash scripts/install-all.sh --check  # Check what's installed
#
# Part of the smilinTux Sovereign Agent ecosystem.
# ============================================================

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Package list: directory name → CLI command name
declare -A PACKAGES=(
  [skcapstone]=skcapstone
  [skmemory]=skmemory
  [skchat]=skchat
  [skcomm]=skcomm
  [capauth]=capauth
  [sksecurity]=sksecurity
  [skseal]=skseal
  [skref]=skref
  [skskills]=skskills
  [cloud9-python]=cloud9
  [skyforge]=skyforge
  [skpdf]=skpdf
)

# Ordered install (skcapstone first, rest alphabetical)
INSTALL_ORDER=(
  skcapstone
  capauth
  cloud9-python
  skchat
  skcomm
  skmemory
  skpdf
  skref
  skseal
  sksecurity
  skskills
  skyforge
)

installed=0
failed=0
skipped=0

check_only=false
if [[ "${1:-}" == "--check" ]]; then
  check_only=true
fi

echo "======================================"
echo "  smilinTux — Sovereign Agent Installer"
echo "======================================"
echo ""

if $check_only; then
  echo "Checking installed CLIs..."
  echo ""
  for pkg in "${INSTALL_ORDER[@]}"; do
    cli="${PACKAGES[$pkg]}"
    if command -v "$cli" &>/dev/null; then
      version=$($cli --version 2>/dev/null || echo "installed")
      printf "  ${GREEN}✓${NC} %-15s → %s (%s)\n" "$pkg" "$cli" "$version"
    else
      printf "  ${RED}✗${NC} %-15s → %s (not found)\n" "$pkg" "$cli"
    fi
  done
  exit 0
fi

# Detect working pip command (pyenv shims can be broken)
PIP="pip"
if ! $PIP --version &>/dev/null; then
  PIP="python3 -m pip"
  if ! $PIP --version &>/dev/null; then
    echo -e "${RED}ERROR: No working pip found. Install pip first.${NC}"
    exit 1
  fi
  echo "Note: Using 'python3 -m pip' (pip shim unavailable)"
  echo ""
fi

echo "Installing from: $ROOT_DIR"
echo ""

for pkg in "${INSTALL_ORDER[@]}"; do
  cli="${PACKAGES[$pkg]}"
  pkg_dir="$ROOT_DIR/$pkg"

  if [[ ! -d "$pkg_dir" ]]; then
    printf "  ${YELLOW}⊘${NC} %-15s — directory not found, skipping\n" "$pkg"
    ((skipped++)) || true
    continue
  fi

  # Try with [all] extras first, fall back to plain install
  if $PIP install -e "$pkg_dir[all]" --quiet 2>/dev/null; then
    printf "  ${GREEN}✓${NC} %-15s → %s (with extras)\n" "$pkg" "$cli"
    ((installed++)) || true
  elif $PIP install -e "$pkg_dir" --quiet 2>/dev/null; then
    printf "  ${GREEN}✓${NC} %-15s → %s\n" "$pkg" "$cli"
    ((installed++)) || true
  else
    printf "  ${RED}✗${NC} %-15s — install failed\n" "$pkg"
    ((failed++)) || true
  fi
done

echo ""
echo "======================================"
echo "  Summary"
echo "======================================"
printf "  Installed: ${GREEN}%d${NC}\n" "$installed"
printf "  Failed:    ${RED}%d${NC}\n" "$failed"
printf "  Skipped:   ${YELLOW}%d${NC}\n" "$skipped"
echo ""

# Rehash pyenv shims if available (new entry points need rehash)
if command -v pyenv &>/dev/null; then
  pyenv rehash 2>/dev/null
fi
hash -r 2>/dev/null

# Verify CLIs
echo "Verifying CLIs..."
echo ""
missing=0
for pkg in "${INSTALL_ORDER[@]}"; do
  cli="${PACKAGES[$pkg]}"
  if command -v "$cli" &>/dev/null; then
    printf "  ${GREEN}✓${NC} %s\n" "$cli"
  else
    printf "  ${RED}✗${NC} %s — not on PATH\n" "$cli"
    ((missing++)) || true
  fi
done

echo ""
if [[ $missing -eq 0 && $failed -eq 0 ]]; then
  echo -e "${GREEN}All packages installed and CLIs verified!${NC}"
else
  echo -e "${YELLOW}Some packages need attention. Check output above.${NC}"
fi
