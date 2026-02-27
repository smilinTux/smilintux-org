#!/usr/bin/env bash
# Run cross-package integration tests for the sovereign stack.
#
# These tests verify full cross-package flows:
#   - CapAuth identity -> SKChat crypto -> SKComm transport -> SKMemory history
#   - CapAuth identity -> SKSeal document signing -> verification
#   - SKSecurity scanning -> quarantine -> SKComm transport safety
#
# Must run from outside the monorepo root (or /tmp) to avoid local
# directories shadowing installed packages.
#
# Usage: ./scripts/test-integration.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
TEST_DIR="$REPO_ROOT/tests/integration"

echo -e "\n\033[1;36m=== Sovereign Stack Integration Tests ===\033[0m\n"

cd /tmp
python -m pytest "$TEST_DIR" -v --tb=short --import-mode=importlib --rootdir=/tmp
