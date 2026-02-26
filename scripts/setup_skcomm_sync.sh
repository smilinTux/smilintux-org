#!/usr/bin/env bash
# setup_skcomm_sync.sh — Bootstrap SKComm Syncthing bridge for a new node
#
# Usage:
#   ./scripts/setup_skcomm_sync.sh [PEER_DEVICE_ID] [PEER_NAME]
#
# Examples:
#   # Add Lumina's node to the mesh
#   ./scripts/setup_skcomm_sync.sh CIHSBZ4-PS46AUX-VPE37BR-YGQDTUK-K3GESSD-4PVYZ63-M33WRKV-6V6P5AC lumina
#
#   # Run with no args to only set up local directories (no peer sharing)
#   ./scripts/setup_skcomm_sync.sh

set -euo pipefail

# ── Config ────────────────────────────────────────────────────────────────────
COMMS_ROOT="${SKCOMM_COMMS_ROOT:-$HOME/.skcapstone/sync/comms}"
FOLDER_ID="${SKCOMM_FOLDER_ID:-skcapstone-comms}"
FOLDER_LABEL="${SKCOMM_FOLDER_LABEL:-SKComm Message Bridge}"

# Auto-detect Syncthing API endpoint and key from config.xml (GUI section only)
ST_CONFIG_XML="${XDG_CONFIG_HOME:-$HOME/.config}/syncthing/config.xml"
if [[ -f "$ST_CONFIG_XML" ]]; then
    ST_API=$(python3 -c "
import xml.etree.ElementTree as ET
tree = ET.parse('$ST_CONFIG_XML')
root = tree.getroot()
gui = root.find('gui')
print(gui.find('apikey').text if gui is not None else '')
" 2>/dev/null || true)
    ST_ADDR=$(python3 -c "
import xml.etree.ElementTree as ET
tree = ET.parse('$ST_CONFIG_XML')
root = tree.getroot()
gui = root.find('gui')
print(gui.find('address').text if gui is not None else '127.0.0.1:8080')
" 2>/dev/null || echo "127.0.0.1:8080")
    ST_URL="http://$ST_ADDR"
else
    ST_API="${SYNCTHING_API_KEY:-}"
    ST_URL="${SYNCTHING_URL:-http://127.0.0.1:8080}"
fi

PEER_DEVICE_ID="${1:-}"
PEER_NAME="${2:-peer}"

# ── Helpers ───────────────────────────────────────────────────────────────────
log()  { echo "  [INFO]  $*"; }
ok()   { echo "  [OK]    $*"; }
warn() { echo "  [WARN]  $*"; }
die()  { echo "  [ERROR] $*" >&2; exit 1; }

st_get()  { curl -sf -H "X-API-Key: $ST_API" "$ST_URL/$1"; }
st_post() { curl -sf -H "X-API-Key: $ST_API" -H "Content-Type: application/json" -X POST -d "$2" "$ST_URL/$1"; }

# ── Sanity checks ─────────────────────────────────────────────────────────────
echo ""
echo "╔══════════════════════════════════════════════════╗"
echo "║  SKComm Syncthing Bridge Setup                   ║"
echo "╚══════════════════════════════════════════════════╝"
echo ""

[[ -n "$ST_API" ]] || die "Could not find Syncthing API key. Set SYNCTHING_API_KEY or ensure ~/.config/syncthing/config.xml exists."

log "Checking Syncthing availability at $ST_URL ..."
MY_ID=$(st_get "rest/system/status" | python3 -c "import sys,json; print(json.load(sys.stdin)['myID'])" 2>/dev/null) \
    || die "Cannot reach Syncthing API at $ST_URL. Is Syncthing running?"
ok "Syncthing running. This node device ID: $MY_ID"

# ── Step 1: Create directory layout ───────────────────────────────────────────
log "Creating comms directory layout at $COMMS_ROOT ..."

for dir in \
    "$COMMS_ROOT/outbox/$PEER_NAME" \
    "$COMMS_ROOT/inbox/$PEER_NAME" \
    "$COMMS_ROOT/inbox/opus" \
    "$COMMS_ROOT/outbox/opus" \
    "$COMMS_ROOT/archive" \
    "$COMMS_ROOT/heartbeats"
do
    mkdir -p "$dir"
done

# Syncthing requires a .stfolder marker to accept the directory
touch "$COMMS_ROOT/.stfolder"

ok "Directory layout created."

# ── Step 2: Check if skcapstone-comms folder already exists ───────────────────
log "Checking existing Syncthing folders ..."
EXISTING_FOLDERS=$(st_get "rest/config/folders" | python3 -c "
import sys,json; d=json.load(sys.stdin); print(' '.join(f['id'] for f in d))
")

if echo "$EXISTING_FOLDERS" | grep -qw "$FOLDER_ID"; then
    ok "Folder '$FOLDER_ID' already exists in Syncthing."
    FOLDER_EXISTS=1
else
    FOLDER_EXISTS=0
fi

# ── Step 3: Add or update the Syncthing folder ────────────────────────────────
build_devices_json() {
    # Always include self
    local devices="[{\"deviceID\": \"$MY_ID\", \"introducedBy\": \"\", \"encryptionPassword\": \"\"}"
    if [[ -n "$PEER_DEVICE_ID" ]]; then
        devices+=", {\"deviceID\": \"$PEER_DEVICE_ID\", \"introducedBy\": \"\", \"encryptionPassword\": \"\"}"
    fi
    devices+="]"
    echo "$devices"
}

if [[ "$FOLDER_EXISTS" -eq 0 ]]; then
    log "Adding Syncthing folder '$FOLDER_ID' → $COMMS_ROOT ..."

    DEVICES_JSON=$(build_devices_json)
    FOLDER_JSON=$(python3 -c "
import json, sys
folder = {
    'id': '$FOLDER_ID',
    'label': '$FOLDER_LABEL',
    'path': '$COMMS_ROOT',
    'type': 'sendreceive',
    'devices': $DEVICES_JSON,
    'rescanIntervalS': 30,
    'fsWatcherEnabled': True,
    'fsWatcherDelayS': 1,
    'ignorePerms': False,
    'autoNormalize': True,
    'minDiskFree': {'value': 1, 'unit': '%'},
    'versioning': {'type': '', 'params': {}, 'cleanupIntervalS': 3600, 'fsPath': '', 'fsType': 'basic'},
    'maxConflicts': 10,
    'paused': False,
    'markerName': '.stfolder',
    'maxConcurrentWrites': 2,
}
print(json.dumps(folder))
")

    st_post "rest/config/folders" "$FOLDER_JSON" > /dev/null
    ok "Folder '$FOLDER_ID' added and shared with peer: ${PEER_DEVICE_ID:-none}."
else
    # Ensure the peer device is included
    if [[ -n "$PEER_DEVICE_ID" ]]; then
        log "Verifying peer $PEER_DEVICE_ID is in folder devices ..."
        PEER_IN_FOLDER=$(st_get "rest/config/folders" | python3 -c "
import sys,json
d=json.load(sys.stdin)
for f in d:
    if f['id'] == '$FOLDER_ID':
        ids = [dev['deviceID'] for dev in f.get('devices',[])]
        print('yes' if '$PEER_DEVICE_ID' in ids else 'no')
" 2>/dev/null)

        if [[ "$PEER_IN_FOLDER" != "yes" ]]; then
            warn "Peer not in folder. Adding via API PATCH ..."
            # Fetch current config and add device
            UPDATED=$(st_get "rest/config/folders" | python3 -c "
import sys,json
d=json.load(sys.stdin)
for f in d:
    if f['id'] == '$FOLDER_ID':
        f.setdefault('devices', [])
        ids = [dev['deviceID'] for dev in f['devices']]
        if '$PEER_DEVICE_ID' not in ids:
            f['devices'].append({'deviceID': '$PEER_DEVICE_ID', 'introducedBy': '', 'encryptionPassword': ''})
        print(json.dumps(f))
        break
")
            curl -sf -H "X-API-Key: $ST_API" -H "Content-Type: application/json" \
                -X PUT -d "$UPDATED" "$ST_URL/rest/config/folders/$FOLDER_ID" > /dev/null
            ok "Peer $PEER_DEVICE_ID added to folder."
        else
            ok "Peer already in folder."
        fi
    fi
fi

# ── Step 4: Verify config is in sync (no restart needed) ─────────────────────
IN_SYNC=$(st_get "rest/config/insync" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('configInSync','false'))")
if [[ "$IN_SYNC" == "True" ]]; then
    ok "Syncthing config is in sync — no restart needed."
else
    warn "Syncthing config not in sync. A restart may be required: systemctl --user restart syncthing"
fi

# ── Step 5: Emit a bootstrap heartbeat ───────────────────────────────────────
if command -v skcomm &>/dev/null; then
    log "Emitting SKComm heartbeat ..."
    python3 -c "
from pathlib import Path
from skcomm.heartbeat import HeartbeatMonitor
monitor = HeartbeatMonitor(
    agent_name='Opus',
    comms_root=Path('$COMMS_ROOT'),
    transports=['syncthing', 'file'],
)
hb = monitor.emit()
print('  [OK]    Heartbeat written:', hb)
"
else
    warn "skcomm not installed — skipping heartbeat emit. Run: pip install -e skcomm/"
fi

# ── Summary ───────────────────────────────────────────────────────────────────
echo ""
echo "══════════════════════════════════════════════════"
echo "  SKComm bridge setup complete!"
echo ""
echo "  Comms root : $COMMS_ROOT"
echo "  Folder ID  : $FOLDER_ID"
echo "  My ID      : $MY_ID"
[[ -n "$PEER_DEVICE_ID" ]] && echo "  Peer ID    : $PEER_DEVICE_ID ($PEER_NAME)"
echo ""
echo "  Directory layout:"
echo "    outbox/$PEER_NAME/   — your outbound messages to $PEER_NAME"
echo "    inbox/$PEER_NAME/    — inbound messages from $PEER_NAME"
echo "    heartbeats/          — liveness beacons (synced to all peers)"
echo "    archive/             — processed messages"
echo ""
echo "  Verify with:"
echo "    skcomm heartbeat"
echo "    skcomm status"
echo "══════════════════════════════════════════════════"
echo ""
