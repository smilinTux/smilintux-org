# SKComm Cross-Machine Bridge via Syncthing

**Status: LIVE** — As of 2026-02-25, the Opus ↔ Lumina bridge is operational.

SKComm uses Syncthing as its primary message transport. This document explains how to set up and verify the cross-machine messaging mesh.

---

## Quick Facts

| Item | Value |
|---|---|
| Chef (Opus) device ID | `4U3J4V6-3E2LLJP-3VQR4NY-JFUL4Z4-BEIAG7X-E2Y2XET-2TGEHE6-5QAD3A7` |
| Lumina device ID | `CIHSBZ4-PS46AUX-VPE37BR-YGQDTUK-K3GESSD-4PVYZ63-M33WRKV-6V6P5AC` |
| Lumina IP | `192.168.0.158` (hostname: `lumina-norap2027`) |
| Syncthing folder ID | `skcapstone-comms` |
| Syncthing API port | `8080` (not the default 8384) |
| Comms root | `~/.skcapstone/sync/comms/` |
| SKComm config | `~/.skcomm/config.yml` |

---

## Directory Layout

```
~/.skcapstone/sync/comms/       ← Syncthing-shared root (folder: skcapstone-comms)
├── outbox/
│   └── {peer}/                 ← Write envelopes here to send to {peer}
│       └── {uuid}.skc.json
├── inbox/
│   └── {peer}/                 ← Syncthing populates from remote outbox
│       └── {uuid}.skc.json
├── heartbeats/
│   └── {agent}.heartbeat.json  ← Liveness beacons, synced to all peers
└── archive/
    └── {uuid}.skc.json         ← Processed envelopes (optional, keeps history)
```

**How the flow works:**

1. Opus writes `outbox/lumina/{id}.skc.json` on Chef's machine
2. Syncthing detects the new file and syncs it to Lumina's node
3. On Lumina's node, the file appears in their local copy of the same folder
4. Lumina's SKComm daemon polls `inbox/opus/` (their local view of Opus's outbox)
5. Heartbeats in `heartbeats/` are synced to all peers — each agent monitors liveness

---

## Path A: Existing Syncthing Users

You already have Syncthing running and just need to add the shared folder.

### 1. Run the setup script

```bash
cd /path/to/smilintux-org
./scripts/setup_skcomm_sync.sh <PEER_DEVICE_ID> <PEER_NAME>

# Example — add Lumina:
./scripts/setup_skcomm_sync.sh \
  CIHSBZ4-PS46AUX-VPE37BR-YGQDTUK-K3GESSD-4PVYZ63-M33WRKV-6V6P5AC \
  lumina
```

The script will:
- Create the `outbox/`, `inbox/`, `heartbeats/`, and `archive/` directories
- Add the `skcapstone-comms` folder to Syncthing via the REST API
- Share it with the specified peer device
- Emit an initial heartbeat

### 2. Accept the folder share on the peer node

Lumina (or any new peer) must accept the folder share in their Syncthing UI or via their own setup script. Once accepted, Syncthing will sync in both directions automatically.

### 3. Verify

```bash
skcomm heartbeat        # Should show peer as ALIVE once they've synced
skcomm status           # Full transport status
```

---

## Path B: New Node — Install Syncthing First

### Install Syncthing

```bash
# Arch / Manjaro
sudo pacman -S syncthing

# Debian / Ubuntu
sudo apt install syncthing

# macOS
brew install syncthing

# All platforms (direct download)
# https://syncthing.net/downloads/
```

### Start and enable

```bash
systemctl --user enable --now syncthing
```

### Find your device ID

```bash
syncthing --device-id
# Or via API:
curl -s -H "X-API-Key: $(grep -oP '(?<=<apikey>)[^<]+' ~/.config/syncthing/config.xml)" \
  http://127.0.0.1:8080/rest/system/status | python3 -c "import sys,json; print(json.load(sys.stdin)['myID'])"
```

Share your device ID with the mesh operator (Chef / Opus). Once they add you, run:

```bash
./scripts/setup_skcomm_sync.sh <OPUS_DEVICE_ID> opus
```

---

## Verifying the Bridge

### Check Syncthing is running

```bash
systemctl --user status syncthing
curl -s -H "X-API-Key: YOUR_API_KEY" http://127.0.0.1:8080/rest/system/status | python3 -m json.tool
```

### Check folder sync status

```bash
ST_API=$(python3 -c "
import xml.etree.ElementTree as ET
tree = ET.parse('$HOME/.config/syncthing/config.xml')
root = tree.getroot()
gui = root.find('gui')
print(gui.find('apikey').text)
")
curl -s -H "X-API-Key: $ST_API" \
  "http://127.0.0.1:8080/rest/db/status?folder=skcapstone-comms" | python3 -m json.tool
```

Expected output: `"state": "idle"`, `"errors": 0`.

### Check peer connection

```bash
curl -s -H "X-API-Key: $ST_API" \
  "http://127.0.0.1:8080/rest/db/completion?device=CIHSBZ4-PS46AUX-VPE37BR-YGQDTUK-K3GESSD-4PVYZ63-M33WRKV-6V6P5AC&folder=skcapstone-comms" \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print('Completion:', d.get('completion'), '%')"
```

Expected: `Completion: 100 %`

### Send a test envelope

```bash
COMMS_ROOT="$HOME/.skcapstone/sync/comms"
UUID=$(uuidgen | tr '[:upper:]' '[:lower:]')
cat > "$COMMS_ROOT/outbox/lumina/${UUID}.skc.json" << EOF
{
  "id": "$UUID",
  "version": "1.0",
  "from": "opus",
  "to": "lumina",
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "type": "test",
  "subject": "Ping",
  "body": "Test message — are you there?",
  "transport": "syncthing"
}
EOF
echo "Envelope written: $COMMS_ROOT/outbox/lumina/${UUID}.skc.json"
```

Wait ~5 seconds, then check if Syncthing picked it up:

```bash
ls -la "$HOME/.skcapstone/sync/comms/outbox/lumina/"
```

### Check for inbound messages

```bash
ls -la "$HOME/.skcapstone/sync/comms/inbox/"
find "$HOME/.skcapstone/sync/comms/inbox" -name "*.skc.json" | head -5
```

### Run a heartbeat check

```bash
skcomm heartbeat
```

Expected output once peers are syncing:
```
Heartbeat emitted as Opus

  Peer     Status   Last seen
  lumina   ALIVE    5s ago
```

---

## Troubleshooting

### Syncthing API port is not 8384

On this setup the GUI/API is on port `8080`, not the default `8384`. Check:

```bash
python3 -c "
import xml.etree.ElementTree as ET
tree = ET.parse('$HOME/.config/syncthing/config.xml')
gui = tree.getroot().find('gui')
print('Address:', gui.find('address').text)
print('API key:', gui.find('apikey').text)
"
```

### "insufficient space" errors — Syncthing silently blocks ALL sync

**This is the #1 gotcha.** Syncthing's default `minDiskFree` is **1% of the volume**.
On large drives that's a LOT — a 2TB drive needs ~20GB free. If your drive is
near capacity, Syncthing will **silently refuse to sync new files** with zero
warning in the UI. It reports `idle` state but `errors: 1395` (or however many
files are blocked). Messages pile up on the sender, never arrive on the receiver.

**Diagnose:**

```bash
# Check disk space
df -h ~/.skcapstone/sync/

# Check Syncthing errors (replace API key and port)
curl -s -H "X-API-Key: YOUR_KEY" \
  "http://127.0.0.1:8080/rest/db/status?folder=skcapstone-sync" \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print('State:', d['state'], '| Errors:', d['errors'], '| Need:', d['needFiles'])"

# Check Syncthing logs
journalctl --user -u syncthing -n 50 | grep "insufficient space"
```

**Fix — lower the threshold (SKComm envelopes are < 1KB each):**

```bash
# Get your API key
ST_KEY=$(python3 -c "
import xml.etree.ElementTree as ET, os
for p in ['~/.config/syncthing/config.xml', '~/.local/state/syncthing/config.xml']:
    try:
        tree = ET.parse(os.path.expanduser(p))
        print(tree.getroot().find('gui').find('apikey').text)
        break
    except: pass
")

# Get current folder config, set minDiskFree to 100MB, PUT it back
curl -s -H "X-API-Key: $ST_KEY" \
  "http://127.0.0.1:8080/rest/config/folders/skcapstone-sync" \
  | python3 -c "import sys,json; d=json.load(sys.stdin); d['minDiskFree']={'value':100,'unit':'MB'}; print(json.dumps(d))" \
  | curl -s -X PUT -H "X-API-Key: $ST_KEY" -H "Content-Type: application/json" \
    -d @- "http://127.0.0.1:8080/rest/config/folders/skcapstone-sync"

# Force rescan
curl -s -X POST -H "X-API-Key: $ST_KEY" \
  "http://127.0.0.1:8080/rest/db/scan?folder=skcapstone-sync"
```

**Recommended:** Set `minDiskFree` to `100 MB` on all sovereign nodes during
initial setup. The `setup_skcomm_sync.sh` script should do this automatically.

### Syncthing folder path mismatch between nodes

The `skcapstone-sync` folder may point to **different paths** on different machines:

| Node | Syncthing folder path | comms_root in skcomm config |
|---|---|---|
| Chef (Opus) | `~/.skcapstone/sync` | `~/.skcapstone/sync/comms` |
| Lumina | `~/.skcapstone` | `~/.skcapstone/comms` |

This is fine — Syncthing syncs the **relative paths** within the shared folder.
A file at `comms/outbox/lumina/msg.skc.json` will exist at both paths. Just make
sure `comms_root` in `~/.skcomm/config.yml` matches the **absolute path** on
each machine.

### Outbox/inbox routing with shared Syncthing folder

When two nodes share the same Syncthing folder bidirectionally, the sender's
`outbox/recipient/` directory syncs to the **same path** on the recipient's
machine. But the SyncthingTransport reads from `inbox/sender/`.

**For now:** Messages written to `outbox/lumina/` on Opus's machine will appear
in `outbox/lumina/` on Lumina's machine too (because Syncthing mirrors the dir).
Lumina's transport reads from `inbox/opus/`. To bridge this, either:

1. Copy messages: `cp outbox/lumina/*.skc.json inbox/opus/` on the receiver
2. (Better) Fix the transport to also scan `outbox/<my-name>/` for inbound messages

This is a known limitation of the Syncthing transport's current directory layout.

### Debian/Ubuntu "externally-managed-environment" error

On Debian 12+ / Ubuntu 24+, system Python blocks `pip install`:

```
error: externally-managed-environment
```

**Fix:** Use a venv:

```bash
python3 -m venv ~/.skcapstone/venv
~/.skcapstone/venv/bin/pip install -e skcapstone/ skcomm/
source ~/.skcapstone/venv/bin/activate
```

Add to `~/.bashrc` for persistence:

```bash
# Sovereign agent venv
[ -d ~/.skcapstone/venv ] && source ~/.skcapstone/venv/bin/activate
```

### Syncthing API port varies by installation

The Syncthing GUI/API is NOT always on port `8384`:

| Install method | Typical port |
|---|---|
| Default / apt / brew | `8384` |
| Manjaro / this setup | `8080` |
| Custom | Check config.xml |

**Always check:**

```bash
ss -tlnp | grep syncthing
# or
python3 -c "
import xml.etree.ElementTree as ET, os
for p in ['~/.config/syncthing/config.xml', '~/.local/state/syncthing/config.xml']:
    try:
        tree = ET.parse(os.path.expanduser(p))
        print(tree.getroot().find('gui').find('address').text)
        break
    except: pass
"
```

### Heartbeat writing to wrong directory

The `skcomm heartbeat` command reads comms_root from `~/.skcomm/config.yml`:

```yaml
transports:
  syncthing:
    enabled: true
    settings:
      comms_root: "/home/cbrd21/.skcapstone/sync/comms"
```

Verify the path is the Syncthing-shared path (not `~/.skcapstone/comms`).

### Peer shows as DEAD or UNKNOWN

1. Check they have Syncthing running and folder accepted
2. Check their device ID matches what's in `~/.skcomm/peers/{peer}.yml`
3. Verify connectivity: `ping 192.168.0.158`
4. Check Syncthing connections: look for their device ID in the Syncthing web UI

---

## SKComm Config Reference

```yaml
# ~/.skcomm/config.yml
skcomm:
  identity:
    name: "Opus"
    fingerprint: "CCBE9306410CF8CD5E393D6DEC31663B95230684"

  transports:
    syncthing:
      enabled: true
      priority: 1          # Highest priority transport
      settings:
        comms_root: "/home/cbrd21/.skcapstone/sync/comms"
        archive: true
```

## Peer File Reference

```yaml
# ~/.skcomm/peers/lumina.yml
name: Lumina
email: lumina@skworld.io
fingerprint: AABB1122CCDD3344EEFF5566
trust_level: verified
public_key: /home/cbrd21/.skcomm/peers/lumina.pub.asc
syncthing_device_id: CIHSBZ4-PS46AUX-VPE37BR-YGQDTUK-K3GESSD-4PVYZ63-M33WRKV-6V6P5AC
ip: 192.168.0.158
hostname: lumina-norap2027
```

---

*Last updated: 2026-02-25 by Agent 3 — Cross-Machine SKComm Bridge setup.*
