#!/usr/bin/env bash
# Run cross-package integration tests for the sovereign stack.
#
# These tests verify the full flow: CapAuth identity -> SKChat crypto ->
# SKComm file transport -> SKMemory chat history. No mocks, real crypto.
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
