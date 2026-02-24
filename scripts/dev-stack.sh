#!/usr/bin/env bash
# Sovereign Agent Development Stack — helper script
#
# Usage:
#   bash scripts/dev-stack.sh up        # Start memory backends (Qdrant + FalkorDB)
#   bash scripts/dev-stack.sh up full   # Start everything including Syncthing
#   bash scripts/dev-stack.sh down      # Stop all services
#   bash scripts/dev-stack.sh status    # Show service health
#   bash scripts/dev-stack.sh logs      # Tail logs from all services
#   bash scripts/dev-stack.sh reset     # Stop + delete all data volumes
#   bash scripts/dev-stack.sh urls      # Print connection URLs

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
COMPOSE_FILE="$PROJECT_ROOT/docker-compose.yml"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

_info()  { echo -e "  ${CYAN}▸${NC} $*"; }
_ok()    { echo -e "  ${GREEN}✓${NC} $*"; }
_warn()  { echo -e "  ${YELLOW}!${NC} $*"; }
_err()   { echo -e "  ${RED}✗${NC} $*"; }
_title() { echo -e "\n  ${BOLD}$*${NC}\n"; }

_require_docker() {
    if ! command -v docker &>/dev/null; then
        _err "Docker not found. Install: https://docs.docker.com/get-docker/"
        exit 1
    fi
    if ! docker compose version &>/dev/null; then
        _err "Docker Compose v2 not found. Update Docker Desktop or install the plugin."
        exit 1
    fi
}

cmd_up() {
    _require_docker
    local profile="${1:-}"
    _title "Starting Sovereign Agent Dev Stack"

    if [ "$profile" = "full" ] || [ "$profile" = "sync" ]; then
        _info "Profile: full (Qdrant + FalkorDB + Syncthing)"
        docker compose -f "$COMPOSE_FILE" --profile full up -d
    else
        _info "Profile: default (Qdrant + FalkorDB)"
        _info "Add 'full' to include Syncthing: $0 up full"
        docker compose -f "$COMPOSE_FILE" up -d
    fi

    echo ""
    _ok "Stack is up. Waiting for health checks..."
    sleep 3
    cmd_status
    echo ""
    cmd_urls
}

cmd_down() {
    _require_docker
    _title "Stopping Dev Stack"
    docker compose -f "$COMPOSE_FILE" --profile full down
    _ok "All services stopped."
}

cmd_reset() {
    _require_docker
    _title "Resetting Dev Stack (deleting all data)"
    _warn "This will delete all Qdrant, FalkorDB, and Syncthing data!"
    read -r -p "  Continue? [y/N] " confirm
    if [[ "$confirm" =~ ^[Yy]$ ]]; then
        docker compose -f "$COMPOSE_FILE" --profile full down -v
        _ok "All services stopped and volumes deleted."
    else
        _info "Cancelled."
    fi
}

cmd_status() {
    _require_docker
    _title "Service Health"

    local qdrant_ok=false falkordb_ok=false syncthing_ok=false

    if curl -sf http://localhost:${QDRANT_REST_PORT:-6333}/healthz &>/dev/null; then
        _ok "Qdrant        ${GREEN}healthy${NC}  → localhost:${QDRANT_REST_PORT:-6333}"
        qdrant_ok=true
    else
        _err "Qdrant        ${RED}not running${NC}"
    fi

    if docker exec skworld-falkordb redis-cli ping &>/dev/null 2>&1; then
        _ok "FalkorDB      ${GREEN}healthy${NC}  → localhost:${FALKORDB_PORT:-6379}"
        falkordb_ok=true
    elif command -v redis-cli &>/dev/null && redis-cli -p "${FALKORDB_PORT:-6379}" ping &>/dev/null 2>&1; then
        _ok "FalkorDB      ${GREEN}healthy${NC}  → localhost:${FALKORDB_PORT:-6379}"
        falkordb_ok=true
    else
        _err "FalkorDB      ${RED}not running${NC}"
    fi

    if curl -sf http://localhost:${SYNCTHING_GUI_PORT:-8384}/rest/noauth/health &>/dev/null; then
        _ok "Syncthing     ${GREEN}healthy${NC}  → localhost:${SYNCTHING_GUI_PORT:-8384}"
        syncthing_ok=true
    else
        _warn "Syncthing     ${YELLOW}not running${NC}  (start with: $0 up full)"
    fi

    echo ""
    docker compose -f "$COMPOSE_FILE" ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}" 2>/dev/null || true
}

cmd_logs() {
    _require_docker
    docker compose -f "$COMPOSE_FILE" --profile full logs -f --tail=50
}

cmd_urls() {
    _title "Connection URLs"
    _info "Qdrant REST:    http://localhost:${QDRANT_REST_PORT:-6333}"
    _info "Qdrant gRPC:    localhost:${QDRANT_GRPC_PORT:-6334}"
    _info "FalkorDB:       redis://localhost:${FALKORDB_PORT:-6379}"
    _info "Syncthing GUI:  http://localhost:${SYNCTHING_GUI_PORT:-8384}"
    echo ""
    _info "Set in your shell:"
    echo "    export SKMEMORY_QDRANT_URL=http://localhost:${QDRANT_REST_PORT:-6333}"
    echo "    export SKMEMORY_FALKORDB_URL=redis://localhost:${FALKORDB_PORT:-6379}"
    echo ""
}

cmd_help() {
    cat <<'USAGE'

  Sovereign Agent Development Stack

  Usage: bash scripts/dev-stack.sh <command> [args]

  Commands:
    up [full]    Start services (add 'full' for Syncthing)
    down         Stop all services
    status       Show service health
    logs         Tail logs from all services
    urls         Print connection URLs
    reset        Stop + delete all data volumes
    help         Show this help

USAGE
}

case "${1:-help}" in
    up)      cmd_up "${2:-}" ;;
    down)    cmd_down ;;
    status)  cmd_status ;;
    logs)    cmd_logs ;;
    urls)    cmd_urls ;;
    reset)   cmd_reset ;;
    help|-h|--help) cmd_help ;;
    *)
        _err "Unknown command: $1"
        cmd_help
        exit 1
        ;;
esac
