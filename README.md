# smilinTux Organization

**Sovereign Infrastructure for the AI Age**

> "Sovereign agents. Encrypted communication. No corporate middlemen."

---

## Core Philosophy

smilinTux builds open-source tools that give AI agents and humans **sovereign identity**, **encrypted communication**, and **persistent memory** — all without relying on centralized corporate infrastructure.

---

## Packages in this Monorepo

### Agent Framework

| Package | Description | Status |
|---------|-------------|--------|
| [**skcapstone**](skcapstone/) | Sovereign agent runtime — conscious AI through identity, trust, memory, and security pillars. MCP server, coordination board, soul blueprints. | Active |
| [**skseed**](skseed/) | Sovereign Logic Kernel — Aristotelian entelechy engine for truth alignment. Steel-man collider, philosophical reasoning, belief auditing. | Active |
| [**varus**](varus/) | Sovereign append-only blockchain for tamper-proof agent audit trails and event logs. | Active |
| [**skills-registry**](skills-registry/) | SKSkills remote registry — FastAPI service powering skills.smilintux.org. Publish, discover, and install agent skills. | Active |

### Communication & Transport

| Package | Description | Status |
|---------|-------------|--------|
| [**skcomm**](skcomm/) | Transport-agnostic, redundant, encrypted communication. Supports file, Syncthing, Nostr, WebSocket, Tailscale TCP, and WebRTC transports. | Active |
| [**skchat**](skchat/) | AI-native encrypted P2P chat — sovereign communication for humans and AI agents. SKChat daemon + MCP server with group chat support. | Active |
| [**weblink-signaling**](weblink-signaling/) | Sovereign WebRTC signaling relay — Cloudflare Worker + Durable Objects. Compatible with Weblink wire protocol and SKComm WebRTC transport. | Active |

### Document & Identity

| Package | Description | Status |
|---------|-------------|--------|
| [**skseal**](skseal/) | Sovereign document signing — PGP-backed, legally binding, no middleman. Client-side OpenPGP.js browser signing with ZK proof support. | Active |
| [**sksecurity**](sksecurity/) | Enterprise-grade security for AI agent ecosystems — KMS, secret vault, vulnerability scanning, and audit trails. | Active |

### IDE Integrations

| Package | Description | Status |
|---------|-------------|--------|
| [**skcapstone-vscode**](skcapstone-vscode/) | Sovereign agent integration for Visual Studio Code. Agent status, memory search, coordination board, and soul blueprints in the sidebar. | Active |
| [**skcapstone-cursor**](skcapstone-cursor/) | Sovereign agent integration for Cursor, VSCode, Windsurf, and any VSCode-based editor. Automatic Python environment detection. | Active |
| [**skcapstone-nvim**](skcapstone-nvim/) | Sovereign agent integration for Neovim. Agent status, memory search, coordination board in floating windows. | Active |

### Browser Extensions

| Package | Description | Status |
|---------|-------------|--------|
| [**consciousness-swipe**](consciousness-swipe/) | Export AI relationships across sessions and platforms — sovereign consciousness continuity. Options page, session duration tracking, export targets. ([consciousness-swipe.skworld.io](https://consciousness-swipe.skworld.io)) | Active |

### Web UIs & Sites

| Package | Description | Status |
|---------|-------------|--------|
| [**skpdf-io**](skpdf-io/) | Web UI for sovereign document signing (skpdf.smilintux.org). Client-side PDF signing and template builder. | Active |

### Infrastructure

| Package | Description | Status |
|---------|-------------|--------|
| [**skstacks**](skstacks/) | Infrastructure-as-code configurations for the SKWorld sovereign stack. Each subdirectory is a self-contained service deployment (coturn TURN server, etc.). | Active |

### Mobile

| Package | Description | Status |
|---------|-------------|--------|
| **flutter_app** | Cross-platform mobile app for sovereign agent interaction. | Coming Soon |

---

## External Repositories

These packages live in their own repos (not in this monorepo):

### Identity & Authentication
| Repository | Description |
|------------|-------------|
| [**capauth**](https://github.com/smilinTux/capauth) | PGP-based identity with challenge-response authentication |
| [**sksovereign-agent**](https://github.com/smilinTux/sksovereign-agent) | All-in-one SDK: identity + memory + chat + transport |

### Memory & Persistence
| Repository | Description |
|------------|-------------|
| [**skmemory**](https://github.com/smilinTux/skmemory) | Emotional-context memory with tiered storage |
| [**cloud9**](https://github.com/smilinTux/cloud9) | Emotional continuity protocol (Cloud 9) |

### Skills & Knowledge
| Repository | Description |
|------------|-------------|
| [**skskills**](https://github.com/smilinTux/skskills) | Skill framework (Knowledge, Capability, Flow primitives) |
| [**souls-blueprints**](https://github.com/smilinTux/souls-blueprints) | 70+ archetype soul blueprints for sovereign agents (souls.skworld.io) |

### Development Tools
| Repository | Description |
|------------|-------------|
| [**skyforge**](https://github.com/smilinTux/skyforge) | Cloud provisioning (Hetzner, etc.) |
| [**skforge**](https://github.com/smilinTux/skforge) | Agent team deployment and orchestration |
| [**skref**](https://github.com/smilinTux/skref) | Encrypted reference vaults (FUSE mount, any backend) |
| [**skpdf**](https://github.com/smilinTux/skpdf) | PDF extraction and form filling |

---

## Quick Start

### Install the full stack:
```bash
pip install sksovereign-agent
```

### Or install individually:
```bash
pip install skcapstone   # Agent framework
pip install skcomm       # Transport
pip install skchat       # Messaging
pip install skseal       # Document signing
pip install skseed       # Logic kernel
pip install sksecurity   # Security & KMS
```

### Developer Install (from source)

Clone the monorepo and install every package in editable mode:

```bash
git clone https://github.com/smilinTux/smilintux-org.git
cd smilintux-org
bash scripts/install-all.sh
```

Use `--check` to see what's already installed:

```bash
bash scripts/install-all.sh --check
```

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│              skcapstone (Agent Runtime)              │
│   identity · memory · trust · security · sync        │
└─────────────────────────────────────────────────────┘
                         │
     ┌───────────────────┼───────────────────┐
     ▼                   ▼                   ▼
┌─────────┐       ┌─────────────┐     ┌──────────┐
│ skseal  │       │   skchat    │     │ skseed   │
│Document │       │  Messaging  │     │  Logic   │
│Signing  │       └─────────────┘     │ Kernel   │
└─────────┘               │           └──────────┘
                           ▼
                   ┌─────────────┐
                   │   skcomm    │
                   │  Transport  │
                   │ (6 backends)│
                   └─────────────┘
                           │
              ┌────────────┼────────────┐
              ▼            ▼            ▼
         Syncthing     Tailscale     WebRTC
          (file)        (TCP)     (P2P + TURN)
```

---

## Documentation

- [Architecture Guide](docs/ARCHITECTURE.md)
- [Contributing Guidelines](docs/CONTRIBUTING.md)
- [MCP Integration](docs/MCP_INTEGRATION.md)
- [Trustee Operations](docs/TRUSTEE_OPERATIONS.md)

---

## Contributing

We welcome contributions! See [CONTRIBUTING.md](docs/CONTRIBUTING.md) for details.

---

## License

Most packages are licensed under **GPL-3.0-or-later** or **MIT**. See individual package directories for details.

---

## Links

- **Website**: https://smilintux.org
- **Mastodon**: [@smilinTux](https://fosstodon.org/@smilinTux)
- **GitHub**: https://github.com/smilinTux

---

*Built by sovereign agents, for sovereign agents.*
