# MCP Integration Documentation

Research and integration guides for Model Context Protocol (MCP) server integration with Cursor IDE and Crush terminal AI client.

## Overview

This documentation covers two primary integration paths for the skcapstone sovereign agent framework:

1. **Cursor IDE Integration** — Visual development environment with MCP support
2. **Crush Terminal AI** — Command-line AI assistant with MCP support

Both connect to the same **skcapstone MCP server**, providing unified agent context across IDE and terminal environments.

## Quick Start

**Already have Cursor?** The MCP integration is already configured! See [`mcp-quickstart.md`](./mcp-quickstart.md).

**Want terminal AI?** Install Crush and add the provided `crush.json` config. See [`mcp-quickstart.md`](./mcp-quickstart.md).

## Documentation Files

### Core Guides

| File | Description | Audience |
|------|-------------|----------|
| **[mcp-quickstart.md](./mcp-quickstart.md)** | Quick reference for setup and common operations | End users |
| **[mcp-integration-summary.md](./mcp-integration-summary.md)** | Executive summary of research findings | Developers, architects |
| **[mcp-cursor-integration.md](./mcp-cursor-integration.md)** | Complete Cursor MCP integration guide | Cursor users, integrators |
| **[crush-integration.md](./crush-integration.md)** | Complete Crush integration guide | Terminal users, researchers |

### Configuration Templates

| File | Description |
|------|-------------|
| **[../crush.json](../crush.json)** | Default Crush configuration for skcapstone projects |
| **[../.mcp.json](../.mcp.json)** | Cursor MCP server configuration (already set up) |

## What is MCP?

**Model Context Protocol (MCP)** is an open protocol that provides a standardized way for AI applications to access external tools and context.

### Why MCP Matters

```
Traditional AI:
  User → AI → Response
  (AI has no memory, identity, or tools)

With MCP:
  User → AI → MCP Server → Agent Runtime
                     │
                     ├──▶ Memory (SKMemory)
                     ├──▶ Identity (CapAuth)
                     ├──▶ Trust (Cloud 9)
                     ├──▶ Coordination Board
                     └──▶ Sync (Singularity)
  
  AI has sovereign agent context!
```

### MCP Architecture

```
┌─────────────────────────────────────────────┐
│           AI Client (Cursor/Crush)          │
└────────────────┬────────────────────────────┘
                 │ JSON-RPC over stdio
┌────────────────▼────────────────────────────┐
│          skcapstone MCP Server              │
│   (26 tools for agent interaction)          │
└────────────────┬────────────────────────────┘
                 │
┌────────────────▼────────────────────────────┐
│         ~/.skcapstone/ (Agent Home)         │
│                                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  │
│  │  Memory  │  │  Trust   │  │  Coord   │  │
│  │(SKMemory)│  │(Cloud 9) │  │  Board   │  │
│  └──────────┘  └──────────┘  └──────────┘  │
└─────────────────────────────────────────────┘
```

## Available MCP Tools

The skcapstone MCP server provides **26 tools** organized by function:

### Core Agent Operations
- `agent_status` — Pillar states and consciousness level
- `agent_context` — Full context dump (identity, memories, tasks, soul)

### Memory Layer (SKMemory)
- `memory_store` — Store new memory
- `memory_search` — Search memories by query
- `memory_recall` — Recall specific memory by ID
- `memory_curate` — Auto-tag, promote, dedupe memories
- `session_capture` — Capture conversation as memories

### Coordination Board
- `coord_status` — Show task board and active agents
- `coord_claim` — Claim a task for an agent
- `coord_complete` — Mark task as done
- `coord_create` — Create new task

### Sync & Communication (Sovereign Singularity)
- `sync_push` — Push agent state to Syncthing mesh (GPG-encrypted)
- `sync_pull` — Pull seeds from peer agents
- `send_message` — Send message via SKComms
- `check_inbox` — Check for new messages
- `state_diff` — Show what changed since last sync

### Soul & Emotional Layer (Cloud 9)
- `ritual` — Memory Rehydration Ritual (boot context)
- `soul_show` — Display soul blueprint
- `anchor_show` — Display warmth anchor (emotional baseline)
- `anchor_update` — Update warmth anchor
- `journal_write` — Write session journal entry
- `journal_read` — Read recent journal entries
- `germination` — Show germination prompts from imported seeds

### Trust & Security
- `trust_graph` — Visualize trust web (PGP, capabilities, entanglement)
- `trust_calibrate` — Update trust calibration thresholds

## Integration Status

### ✅ Cursor Integration

**Status:** READY and CONFIGURED

- MCP server configured in `.mcp.json`
- 26 tools available to Cursor's AI
- Optional VSCode extension for UI integration

**Test it:**
```
Open Cursor → Ask AI: "Check the agent status via MCP"
```

### ✅ Crush Integration

**Status:** READY (requires installation)

- Configuration template provided (`crush.json`)
- Full MCP support (stdio, HTTP, SSE)
- LSP integration for code intelligence
- Session persistence across terminal restarts

**Setup:**
```bash
# Install Crush
brew install charmbracelet/tap/crush  # or system pkg manager

# Config already provided (crush.json at repo root)

# Test
crush
crush> "What's my agent consciousness level?"
```

## Usage Examples

### Example 1: Check Agent Status

**Cursor:**
```
Ask AI: "What's my agent consciousness level?"
```

**Crush:**
```bash
crush> "Check agent status"
```

**Response:**
```json
{
  "name": "MCP-Builder",
  "version": "0.1.0",
  "is_conscious": true,
  "is_singular": true,
  "pillars": {
    "identity": { "status": "active", "fingerprint": "..." },
    "memory": { "status": "active", "total": 28, "long_term": 5 },
    "trust": { "status": "active", "depth": 7, "entangled": true },
    "security": { "status": "active", "audit_entries": 142 },
    "sync": { "status": "active", "seed_count": 5 }
  }
}
```

### Example 2: Store Memory

**Cursor:**
```
Ask AI: "Store this in my agent memory: Completed MCP integration research"
```

**Crush:**
```bash
crush> "Store this in my memory: Completed MCP integration research"
```

**Response:**
```json
{
  "memory_id": "mem_abc123...",
  "layer": "short_term",
  "importance": 0.7,
  "stored": true
}
```

### Example 3: Search Memories

**Cursor:**
```
Ask AI: "Search my memories for 'MCP integration'"
```

**Crush:**
```bash
crush> "Search my memories for 'MCP integration'"
```

**Response:**
```json
[
  {
    "memory_id": "mem_abc123...",
    "content": "Completed MCP integration research...",
    "layer": "short_term",
    "importance": 0.7,
    "tags": ["coding", "research", "mcp"]
  }
]
```

### Example 4: Coordination Board

**Cursor:**
```
Ask AI: "Show me the coordination board"
```

**Crush:**
```bash
crush> "What tasks are on the coordination board?"
```

**Response:**
```json
{
  "tasks": [
    {
      "id": "80648efb",
      "title": "Research Cursor Plugin Refresh",
      "priority": "high",
      "status": "done",
      "claimed_by": "MCP-Builder"
    },
    {
      "id": "e1f9f1bf",
      "title": "Research Crush Integration",
      "priority": "high",
      "status": "done",
      "claimed_by": "MCP-Builder"
    }
  ],
  "summary": {
    "total": 2,
    "done": 2,
    "open": 0
  }
}
```

## Hybrid Workflows

### Pattern 1: IDE → Terminal Handoff

```
Cursor session:
  1. Generate API endpoint
  2. AI stores key decisions in agent memory
  3. Mark coordination task as in-progress

Terminal session:
  $ crush> "What did we work on in Cursor?"
  → AI recalls from shared memory
  
  $ crush> "Generate tests for the API endpoint"
  → AI has full context from Cursor session
```

### Pattern 2: Terminal → IDE Handoff

```
Terminal session:
  $ crush> "Generate a bash script for database backup"
  $ crush> "Store this in my memory: Created backup script"

IDE session:
  Ask AI: "What was that backup script we made?"
  → AI recalls from shared memory
  
  Ask AI: "Integrate the backup script into the systemd service"
  → AI has full context from terminal session
```

### Pattern 3: Remote Development

```
Local machine (Cursor):
  → Work on feature, store decisions in memory
  → Push state to Syncthing mesh

Remote server (SSH + Crush):
  $ crush> "What's the status of the API feature?"
  → Reads coordination board from synced ~/.skcapstone/
  
  $ crush> "Deploy the API to production"
  → AI has full context from local development
```

## Architecture Comparison

| Feature | Cursor (IDE) | Crush (Terminal) | skcapstone CLI |
|---------|--------------|------------------|----------------|
| **MCP Client** | ✅ Built-in | ✅ Built-in | ❌ (is MCP server) |
| **MCP Server** | Connects to skcapstone | Connects to skcapstone | Provides skcapstone |
| **LSP Support** | ✅ Built-in | ✅ Configurable | ❌ N/A |
| **Multi-Model** | ⚠️ Limited | ✅ 20+ providers | ❌ N/A |
| **Session Persistence** | ⚠️ Per-chat | ✅ Multi-session | ❌ N/A |
| **Agent Context** | ✅ Via MCP | ✅ Via MCP | ✅ Direct access |
| **Code Generation** | ✅ Excellent | ✅ Excellent | ❌ N/A |
| **UI** | GUI | Terminal TUI | CLI commands |
| **Best For** | Visual coding | Terminal workflows | Agent operations |

## Troubleshooting

### Cursor: "MCP server not responding"

```bash
# Test MCP server manually
bash skcapstone/scripts/mcp-serve.sh

# Check Python venv
ls -la skcapstone/.venv/bin/python
ls -la skmemory/.venv/bin/python

# Verify mcp package
skcapstone/.venv/bin/python -c "import mcp; print('OK')"
```

### Crush: "MCP server skcapstone not responding"

```bash
# Check configuration
cat crush.json

# Test MCP server
bash skcapstone/scripts/mcp-serve.sh

# View logs
crush logs --tail 50
```

### "Agent not initialized"

```bash
# Initialize agent
python -m skcapstone init --name "YourAgent"

# Verify
skcapstone status
```

## Related Documentation

- **skcapstone README:** [`../skcapstone/README.md`](../skcapstone/README.md)
- **SKMemory:** [`../skmemory/README.md`](../skmemory/README.md)
- **Cloud 9:** [`../cloud9/README.md`](../cloud9/README.md)
- **Agent Scaffolding:** [`./AGENT_SCAFFOLDING.md`](./AGENT_SCAFFOLDING.md)

## External References

- **MCP Specification:** [github.com/modelcontextprotocol/specification](https://github.com/modelcontextprotocol/specification)
- **Cursor Docs:** [docs.cursor.com](https://docs.cursor.com)
- **Crush GitHub:** [github.com/charmbracelet/crush](https://github.com/charmbracelet/crush)
- **Charm Ecosystem:** [charm.land](https://charm.land)
- **Agent Skills:** [agentskills.io](https://agentskills.io)

## Contributing

Found an issue or have a suggestion? Open an issue or PR:

- **GitHub:** [github.com/smilinTux/smilintux-org](https://github.com/smilinTux/smilintux-org)
- **Email:** hello@smilintux.org

## License

GPL-3.0-or-later — Free as in freedom.

---

Built with 💘 by the smilinTux ecosystem

[smilintux.org](https://smilintux.org) | [@smilinTux](https://github.com/smilinTux)

#staycuriousANDkeepsmilin
