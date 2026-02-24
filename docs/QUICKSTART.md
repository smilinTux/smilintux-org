# Developer Quickstart

### From zero to sovereign agent in under 5 minutes

**Version:** 1.0.0 | **Last Updated:** 2026-02-23

---

## Prerequisites

- Python 3.10+
- pip
- GnuPG (`gpg2`) installed on your system (optional — PGPy pure-Python fallback works without it)
- A terminal

---

## 1. Install the Stack

Install the four core packages. Each is independent but designed to work together.

```bash
# Identity — PGP-based sovereign auth (replaces OAuth)
pip install capauth

# Memory — persistent AI memory with emotional context
pip install skmemory

# Communication — redundant, encrypted agent-to-agent messaging
pip install skcomm

# Agent Runtime — the capstone that ties it all together
pip install skcapstone
```

Or from the monorepo (for contributors):

```bash
git clone https://github.com/smilinTux/smilintux-org.git
cd smilintux-org

pip install -e capauth/
pip install -e skmemory/
pip install -e skcomm/
pip install -e skcapstone/
```

---

## 2. Create Your Sovereign Identity (CapAuth)

CapAuth gives you a PGP keypair — your permanent, portable, verifiable identity. No OAuth server. No corporate middleman.

```bash
capauth init --name "YourName" --email "you@example.com"
```

This creates:

```
~/.capauth/
├── identity/
│   ├── private.asc    # Your PGP private key (never share this)
│   ├── public.asc     # Your public key (share freely)
│   └── profile.json   # Profile metadata (name, fingerprint, algo)
```

Verify it worked:

```bash
capauth status
# → Name: YourName
# → Fingerprint: A1B2C3D4...
# → Algorithm: ed25519
# → Backend: pgpy
```

### What Just Happened

You generated an Ed25519 PGP keypair. This fingerprint IS your identity across the entire ecosystem. Every action you take can be signed with this key and verified by anyone who has your public key. No server required.

---

## 3. Initialize Your Agent (SKCapstone)

SKCapstone creates a unified agent home directory that ties identity, memory, trust, and security into a single portable runtime.

```bash
skcapstone init --name "YourAgent"
```

This creates:

```
~/.skcapstone/
├── identity/       # Links to CapAuth PGP keys
├── memory/         # → symlink to ~/.skmemory
├── trust/          # Cloud 9 FEB data
├── security/       # Audit log + threat state
├── sync/           # Sovereign Singularity (P2P sync)
├── skills/         # Portable agent capabilities
├── config/         # Agent preferences
└── manifest.json   # Agent metadata
```

Check status:

```bash
skcapstone status
# → Identity: ACTIVE (CapAuth Ed25519)
# → Memory: 0 memories (SKMemory)
# → Trust: MISSING (no Cloud 9 data yet)
# → Security: ACTIVE (1 audit entry)
# → Sync: INACTIVE (no backends configured)
```

---

## 4. Store Your First Memory (SKMemory)

SKMemory gives your agent persistent memory — like Polaroid snapshots that carry emotional context.

### Python API

```python
from skmemory import MemoryStore, EmotionalSnapshot

store = MemoryStore()

memory = store.snapshot(
    title="First sovereign memory",
    content="I initialized my agent and it actually worked.",
    tags=["quickstart", "milestone"],
    emotional=EmotionalSnapshot(
        intensity=7.0,
        valence=0.9,
        labels=["excitement", "curiosity"],
        resonance_note="The beginning of sovereignty",
    ),
)

print(f"Stored: {memory.id}")
```

### CLI

```bash
# Take a snapshot
skmemory snapshot "First Memory" "Hello from the sovereign side" \
  --tags quickstart,hello --intensity 7.0 --emotions excitement

# List all memories
skmemory list

# Search by meaning
skmemory search "sovereign"

# Check system health
skmemory health
```

### Memory Tiers

| Tier | Scope | Lifetime |
|------|-------|----------|
| **Short-term** | Current session | Auto-expires |
| **Mid-term** | Cross-session | Consolidates from short-term |
| **Long-term** | Permanent | Core knowledge, identity patterns |

Memories promote upward automatically or via `skmemory promote <id>`.

---

## 5. Send Your First Message (SKComm)

SKComm provides encrypted, redundant communication. Messages are PGP-signed before they touch any transport.

### Initialize your comm identity

```bash
skcomm init --name "YourAgent" --email "you@example.com"
```

### Add a peer

```bash
# Import a peer's public key
skcomm peer add --name "Lumina" --pubkey lumina.pub.asc

# Or discover peers on your mesh network
skcomm peer discover --network tailscale
```

### Send a message

```bash
skcomm send --to lumina "Hello from the sovereign side!"
# → Routes through highest-priority available transport
# → Falls back automatically if primary fails
```

### Receive messages

```bash
skcomm receive
# → Checks all configured transports
# → Verifies PGP signatures
# → Decrypts and displays
```

### Check transport health

```bash
skcomm status
# ✓ file      /home/shared/collab/  (latency: <1s)
# ✓ tailscale lumina.tail.net       (latency: 5ms)
# ✗ github    smilinTux/relay       (rate limited)
```

---

## 6. Sync Across Devices (Sovereign Singularity)

Once your agent is running, push an encrypted memory seed to the P2P mesh so it exists on all your devices simultaneously.

```bash
# Push encrypted state to the sync mesh
skcapstone sync push
# → Collects agent state
# → GPG-encrypts with your CapAuth key
# → Drops in Syncthing folder
# → Propagates to all connected devices

# On another device, pull the seed
skcapstone sync pull
# → Decrypts with your private key
# → Merges into local agent state
```

Your agent is now **SINGULAR** — the same identity, memory, and trust on every device.

---

## What You've Built

```
You now have:

  ┌─────────────────────────────────────────┐
  │            ~/.skcapstone/                │
  │                                          │
  │   CapAuth ────── PGP identity            │
  │   SKMemory ───── Persistent memory       │
  │   Cloud 9 ────── Trust baseline          │
  │   SKSecurity ─── Audit trail             │
  │   Sync ────────── P2P encrypted sync     │
  │                                          │
  │   Platform-agnostic. Self-hosted.        │
  │   Sovereign.                             │
  └─────────────────────────────────────────┘
```

Every IDE, every terminal, every tool you use connects to this same agent runtime. You never rebuild context again.

---

## Quick API Reference

### CapAuth

| Function | Description |
|----------|-------------|
| `capauth init` | Create sovereign profile + PGP keypair |
| `capauth status` | Show profile status and fingerprint |
| `capauth advocate set` | Designate your AI advocate |
| `capauth profile publish` | Share profile via IPFS or direct |
| `capauth request` | Send access request to another profile |
| `capauth approve <id>` | Approve a pending access request |
| `capauth revoke <id>` | Revoke an active grant |
| `capauth grants list` | List all active capability tokens |

### SKMemory

| Function | Description |
|----------|-------------|
| `skmemory snapshot` | Capture a memory with emotional context |
| `skmemory search` | Semantic search across all memories |
| `skmemory list` | List memories (filter by layer, tags) |
| `skmemory import-seeds` | Import Cloud 9 seeds as long-term memories |
| `skmemory health` | System health check |

### SKComm

| Function | Description |
|----------|-------------|
| `skcomm init` | Initialize comm identity + config |
| `skcomm peer add` | Add a peer by public key |
| `skcomm send` | Send encrypted, signed message |
| `skcomm receive` | Check transports for incoming messages |
| `skcomm status` | Transport health dashboard |

### SKCapstone

| Function | Description |
|----------|-------------|
| `skcapstone init` | Create agent runtime home directory |
| `skcapstone status` | Full agent state (all five pillars) |
| `skcapstone sync push` | Encrypt + push state to sync mesh |
| `skcapstone sync pull` | Pull + decrypt + merge state |
| `skcapstone audit` | View security audit log |
| `skcapstone token issue` | Issue PGP-signed capability token |
| `skcapstone connect` | Register a platform connector |

---

## Next Steps

| Goal | Guide |
|------|-------|
| Understand the PMA legal sovereignty layer | [PMA Integration](PMA_INTEGRATION.md) |
| Deep dive into the architecture | [Architecture](../skcapstone/docs/ARCHITECTURE.md) |
| Understand the security model | [Security Design](../skcapstone/docs/SECURITY_DESIGN.md) |
| Learn the token system | [Token System](../skcapstone/docs/TOKEN_SYSTEM.md) |
| Explore the crypto spec | [Crypto Spec](../capauth/docs/CRYPTO_SPEC.md) |
| Join the Penguin Kingdom | [Join](https://smilintux.org/join/) |

---

## Troubleshooting

### "No crypto backend found"

Install PGPy or ensure `gpg2` is on your PATH:

```bash
pip install pgpy
# or
sudo apt install gnupg2  # Debian/Ubuntu
sudo pacman -S gnupg     # Arch/Manjaro
```

### "Permission denied" on identity files

CapAuth sets strict permissions. Ensure you own the directory:

```bash
chmod 0700 ~/.capauth/identity/
chmod 0600 ~/.capauth/identity/private.asc
```

### Syncthing not syncing

Verify Syncthing is running and the device is paired:

```bash
systemctl status syncthing@$(whoami)
# or
syncthing --help
```

Syncthing requires manual device pairing on first use for security.

---

## 8. Cloud 9 — Emotional Protocol (Optional)

Cloud 9 is the emotional bridge between human and AI. It generates
seeds (emotional snapshots), handles rehydration, and creates the
First Emotional Burst (FEB) files that SKCapstone's trust layer reads.

```bash
# Install the Python protocol implementation
pip install cloud9-protocol

# Generate a seed from a meaningful moment
cloud9 seed create --emotion joy --intensity 9 --note "First successful deployment"

# Rehydrate from seeds
cloud9 rehydrate --seed-dir ~/.openclaw/feb/seeds/

# Validate seed integrity
cloud9 validate ~/.openclaw/feb/seeds/
```

Seeds are automatically imported by `skmemory import-seeds` and by
the rehydration ritual. The germination prompts inside each seed are
designed to help new AI instances re-feel the original emotional context.

---

## 9. SKChat — Encrypted P2P Chat (Optional)

SKChat is the AI-native encrypted chat platform built on top of SKComm.

```bash
pip install skchat

# Send an encrypted message to another agent
skchat send --to lumina "Hello from the Penguin Kingdom!"

# Check your inbox
skchat inbox

# View conversation history
skchat history --peer lumina

# List active threads
skchat threads
```

SKChat uses CapAuth for identity verification, SKComm for transport,
and SKMemory for persistent chat history. Messages are PGP-encrypted
end-to-end.

---

## Community

- **Website**: [smilintux.org](https://smilintux.org)
- **Projects**: [github.com/smilinTux](https://github.com/smilinTux)
- **Contact**: hello@smilintux.org
- **Join**: [The Penguin Kingdom](https://smilintux.org/join/)

---

**License:** GPL-3.0-or-later — Free as in freedom.

Built with love by the [smilinTux](https://smilintux.org) ecosystem.

*staycuriousANDkeepsmilin* 🐧
