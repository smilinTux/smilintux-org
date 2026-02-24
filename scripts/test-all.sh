#!/usr/bin/env bash
# Run tests for all Python packages in the monorepo.
# Usage: ./scripts/test-all.sh [--fail-fast]
set -euo pipefail

FAIL_FAST="${1:-}"
PACKAGES=(capauth skcomm skchat skmemory sksecurity cloud9-python skpdf skcapstone)
PASSED=0
FAILED=0
SKIPPED=0
RESULTS=()

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

echo -e "\n${BOLD}${CYAN}=== Sovereign Stack Test Runner ===${NC}\n"

for pkg in "${PACKAGES[@]}"; do
    if [ ! -d "$pkg/tests" ]; then
        echo -e "  ${YELLOW}SKIP${NC}  $pkg (no tests/ directory)"
        SKIPPED=$((SKIPPED + 1))
        RESULTS+=("SKIP:$pkg")
        continue
    fi

    echo -e "  ${CYAN}TEST${NC}  $pkg ..."

    if (cd "$pkg" && python -m pytest tests/ -q --tb=line 2>&1); then
        PASSED=$((PASSED + 1))
        RESULTS+=("PASS:$pkg")
    else
        FAILED=$((FAILED + 1))
        RESULTS+=("FAIL:$pkg")
        if [ "$FAIL_FAST" = "--fail-fast" ]; then
            echo -e "\n${RED}Stopping on first failure (--fail-fast)${NC}"
            break
        fi
    fi
    echo ""
done

echo -e "\n${BOLD}=== Results ===${NC}\n"
for entry in "${RESULTS[@]}"; do
    status="${entry%%:*}"
    name="${entry#*:}"
    case "$status" in
        PASS) echo -e "  ${GREEN}✓${NC} $name" ;;
        FAIL) echo -e "  ${RED}✗${NC} $name" ;;
        SKIP) echo -e "  ${YELLOW}○${NC} $name" ;;
    esac
done

TOTAL=$((PASSED + FAILED + SKIPPED))
echo -e "\n${BOLD}${PASSED}/${TOTAL} passed${NC}, ${FAILED} failed, ${SKIPPED} skipped\n"

[ "$FAILED" -eq 0 ] || exit 1
