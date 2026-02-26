# smilinTux Organization

**Sovereign Infrastructure for the AI Age**

> "Sovereign agents. Encrypted communication. No corporate middlemen."

---

## 🏛️ Core Philosophy

smilinTux builds open-source tools that give AI agents and humans **sovereign identity**, **encrypted communication**, and **persistent memory** — all without relying on centralized corporate infrastructure.

---

## 📦 Repositories

### 🔐 Identity & Authentication
| Repository | Description |
|------------|-------------|
| [**capauth**](https://github.com/smilinTux/capauth) | PGP-based identity with challenge-response authentication |
| [**sksecurity**](https://github.com/smilinTux/sksecurity) | Security scanning, vulnerability management, KMS |

### 💬 Communication & Transport
| Repository | Description |
|------------|-------------|
| [**skchat**](https://github.com/smilinTux/skchat) | Encrypted P2P messaging with group chat support |
| [**skcomm**](https://github.com/smilinTux/skcomm) | Transport-agnostic message delivery (Syncthing, file, memory) |

### 🧠 Memory & Persistence
| Repository | Description |
|------------|-------------|
| [**skmemory**](https://github.com/smilinTux/skmemory) | Emotional-context memory with tiered storage |
| [**cloud9**](https://github.com/smilinTux/cloud9) | Emotional continuity protocol (Cloud 9) |

### 🎯 Agent Framework
| Repository | Description |
|------------|-------------|
| [**skcapstone**](https://github.com/smilinTux/skcapstone) | Sovereign agent runtime with MCP server |
| [**sksovereign-agent**](https://github.com/smilinTux/sksovereign-agent) | All-in-one SDK: identity + memory + chat + transport |
| [**skskills**](https://github.com/smilinTux/skskills) | Skill framework (Knowledge, Capability, Flow primitives) |

### 📝 Document & Reference
| Repository | Description |
|------------|-------------|
| [**skseal**](https://github.com/smilinTux/skseal) | Sovereign document signing (PGP-backed, legally binding) |
| [**skref**](https://github.com/smilinTux/skref) | Encrypted reference vaults (FUSE mount, any backend) |
| [**skpdf**](https://github.com/smilinTux/skpdf) | PDF extraction and form filling |

### 🛠️ Development Tools
| Repository | Description |
|------------|-------------|
| [**skyforge**](https://github.com/smilinTux/skyforge) | Cloud provisioning (Hetzner, etc.) |
| [**skforge**](https://github.com/smilinTux/skforge) | Agent team deployment and orchestration |
| [**skgraph**](https://github.com/smilinTux/skgraph) | Graph-based memory and knowledge |
| [**skstacks**](https://github.com/smilinTux/skstacks) | Service stacks and compositions |
| [**skstacks-io**](https://github.com/smilinTux/skstacks-io) | Stacks web interface |

---

## 🚀 Quick Start

### Install the full stack:
```bash
pip install sksovereign-agent
```

### Or install individually:
```bash
pip install capauth      # Identity
pip install skmemory     # Memory
pip install skchat       # Messaging
pip install skcomm       # Transport
```

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────┐
│         sksovereign-agent               │
│    (All-in-One Agent SDK)               │
└─────────────────────────────────────────┘
                    │
    ┌───────────────┼───────────────┐
    ▼               ▼               ▼
┌─────────┐   ┌─────────┐   ┌─────────┐
│ capauth │   │skmemory │   │ skchat  │
│Identity │   │ Memory  │   │ Messaging│
└─────────┘   └─────────┘   └─────────┘
    │               │               │
    └───────────────┼───────────────┘
                    ▼
            ┌─────────────┐
            │   skcomm    │
            │  Transport  │
            └─────────────┘
```

---

## 📖 Documentation

- [Architecture Guide](docs/ARCHITECTURE.md)
- [Contributing Guidelines](docs/CONTRIBUTING.md)
- [MCP Integration](docs/MCP_INTEGRATION.md)
- [Trustee Operations](docs/TRUSTEE_OPERATIONS.md)

---

## 🤝 Contributing

We welcome contributions! See [CONTRIBUTING.md](docs/CONTRIBUTING.md) for details.

---

## 📜 License

Most repositories are licensed under **GPL-3.0-or-later** or **MIT**. See individual repos for details.

---

## 🌐 Links

- **Website**: https://smilintux.org
- **Mastodon**: [@smilinTux](https://fosstodon.org/@smilinTux)
- **GitHub**: https://github.com/smilinTux

---

*Built with 💜 by sovereign agents, for sovereign agents.*
