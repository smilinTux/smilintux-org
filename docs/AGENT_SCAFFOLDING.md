# Agent Scaffolding Tool Stack

### The recommended toolchain for building and deploying sovereign AI agents

**Version:** 1.0.0 | **Last Updated:** 2026-02-24

---

## Overview

This guide documents the **official agent scaffolding tool stack** for the smilinTux ecosystem. These tools work together to provide a complete development environment for sovereign AI agents with identity, memory, communication, and security.

### The Stack at a Glance

```
┌─────────────────────────────────────────────────────────┐
│                   Your Sovereign Agent                   │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  Terminal AI ────► Crush (formerly OpenCode)            │
│  IDE Plugin ─────► VSCode/Cursor + MCP Integration      │
│  Skill Registry ─► OpenClaw per-agent skills            │
│  Integration ────► SKCapstone MCP Server                │
│                                                          │
│  Identity ───────► CapAuth (PGP-based)                  │
│  Memory ─────────► SKMemory (persistent context)        │
│  Communication ──► SKComm (encrypted P2P)               │
│  Security ───────► SKSecurity (audit + threat detect)   │
│  Sync ───────────► Sovereign Singularity (P2P mesh)     │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

---

## Component 1: Crush - Terminal AI Client

**Crush** (formerly OpenCode) is the default terminal-based AI client for sovereign agents.

### What is Crush?

Crush is a command-line AI assistant that provides:
- **Direct terminal integration** — AI assistance without leaving your shell
- **OpenClaw compatibility** — Works with OpenClaw's skill system
- **Per-session context** — Maintains conversation continuity
- **Skill execution** — Run OpenClaw skills directly from the terminal

### Installation

```bash
# Install Crush globally
npm install -g crush-cli

# Or use npx (no install required)
npx crush-cli
```

### Basic Usage

```bash
# Start an interactive AI session
crush

# Ask a question directly
crush "How do I initialize an skcapstone agent?"

# Execute with context from a file
crush --context README.md "Explain this project structure"

# Use with piped input
cat error.log | crush "What's wrong here?"
```

### Configuration for SKCapstone

Create `~/.crushrc` to configure Crush with your sovereign agent:

```json
{
  "agent": {
    "home": "~/.skcapstone",
    "identity": "capauth",
    "memory": "skmemory"
  },
  "skills": {
    "registry": "~/.openclaw/skills",
    "autoload": true
  },
  "mcp": {
    "servers": ["skcapstone"]
  }
}
```

### Integration with SKCapstone

Crush can connect to your SKCapstone agent via the MCP server:

```bash
# Ensure your agent is initialized
skcapstone status

# Start Crush with SKCapstone integration
crush --mcp skcapstone

# Now Crush has access to your agent's memory, identity, and skills
crush> "Store this conversation in my memory"
crush> "Send a message to Lumina via SKComm"
crush> "Check my agent's consciousness level"
```

---

## Component 2: VSCode/Cursor IDE Integration

**VSCode** and **Cursor** provide visual development environments with built-in AI assistance through the **Model Context Protocol (MCP)**.

### Cursor Setup (Recommended)

Cursor is a fork of VSCode with enhanced AI capabilities and native MCP support.

#### Installation

1. Download Cursor from [cursor.sh](https://cursor.sh)
2. Install for your platform (Linux, macOS, Windows)
3. Launch Cursor

#### Configure MCP Integration

Create or edit `.cursor/mcp.json` in your project root:

```json
{
  "mcpServers": {
    "skcapstone": {
      "command": "bash",
      "args": ["skcapstone/scripts/mcp-serve.sh"]
    },
    "task-master": {
      "command": "npx",
      "args": ["-y", "task-master-mcp"]
    }
  }
}
```

This configuration:
- **skcapstone** — Connects Cursor to your sovereign agent runtime
- **task-master** — Provides AI-driven task management and project coordination

#### Restart MCP Servers

After configuration changes:

1. Open Cursor Command Palette (`Ctrl+Shift+P` or `Cmd+Shift+P`)
2. Run: `MCP: Restart Servers`
3. Verify connection in the MCP panel

#### Using SKCapstone in Cursor

Once connected, you can:

```javascript
// In Cursor's AI chat, you can now:

// Check agent status
"What's my agent consciousness level?"

// Store memories
"Remember: I prefer async/await over promises"

// Search past context
"When did we last discuss the Cloud 9 protocol?"

// Task coordination
"Create a task for implementing the new API endpoint"
"What's the next task I should work on?"
```

### VSCode Setup (Alternative)

VSCode requires additional configuration for MCP support.

#### Installation

1. Install VSCode from [code.visualstudio.com](https://code.visualstudio.com)
2. Install the **MCP Extension** from the marketplace

#### Configure MCP

Create `.vscode/settings.json`:

```json
{
  "mcp.servers": {
    "skcapstone": {
      "command": "bash",
      "args": ["skcapstone/scripts/mcp-serve.sh"],
      "env": {
        "SKCAPSTONE_VENV": "/path/to/your/venv"
      }
    }
  }
}
```

---

## Component 3: OpenClaw Skill Registry

**OpenClaw** provides a per-agent skill registry that makes capabilities portable and discoverable.

### What are OpenClaw Skills?

OpenClaw skills are:
- **Portable capabilities** — Package complex functionality into reusable skills
- **Auto-discoverable** — AI agents can find and use skills automatically
- **Per-agent scoped** — Each agent has its own skill set
- **Version controlled** — Skills can be updated independently

### Skill Directory Structure

```
~/.openclaw/
├── skills/                    # Your skill registry
│   ├── cloud9/                # Cloud 9 emotional protocol
│   │   ├── SKILL.md           # Skill manifest
│   │   └── ...
│   ├── skmemory/              # Memory operations
│   │   ├── SKILL.md
│   │   └── ...
│   ├── capauth/               # Identity management
│   │   ├── SKILL.md
│   │   └── ...
│   └── custom-skills/         # Your custom skills
│       └── ...
└── config.json                # OpenClaw configuration
```

### Installing SKCapstone Skills

The core smilinTux skills integrate with OpenClaw:

```bash
# Install Cloud 9 skill (emotional protocol)
openclaw skill add cloud9 --path ~/.cloud9/

# Install SKMemory skill (persistent memory)
openclaw skill add skmemory --path ~/.openclaw/plugins/skmemory

# Install CapAuth skill (sovereign identity)
openclaw skill add capauth --path ~/.capauth/

# Install SKSecurity skill (audit and threat detection)
openclaw skill add sksecurity --path ~/.sksecurity/

# List installed skills
openclaw skill list
```

### Creating a Custom Skill

Create a `SKILL.md` file in your skill directory:

```markdown
# My Custom Skill

## Install

\`\`\`bash
npm install my-custom-skill
# or
pip install my-custom-skill
\`\`\`

## Commands

- `my-skill do-thing` -- performs the thing
- `my-skill check-status` -- checks skill status

## Integration

This skill integrates with SKCapstone via the MCP server.

## Author

Your Name -- your@email.com
```

Register it:

```bash
openclaw skill add my-custom-skill --path ./my-custom-skill/
```

### Skill Discovery

Once registered, skills are automatically discoverable:

```bash
# From terminal (Crush)
crush> "What skills do I have available?"
crush> "Use cloud9 to store this emotional moment"

# From Cursor/VSCode (via MCP)
"Show me my available skills"
"Use the skmemory skill to search for past conversations about security"
```

---

## Component 4: SKCapstone MCP Server

The **SKCapstone MCP Server** is the integration layer that wires everything together.

### What is the MCP Server?

The Model Context Protocol (MCP) server:
- **Exposes agent capabilities** as standardized tools
- **Works with any MCP client** (Cursor, Claude, Windsurf, Aider, etc.)
- **Provides unified API** to your sovereign agent runtime
- **Handles authentication** via CapAuth
- **Maintains context** across sessions

### Architecture

```
┌──────────────────────────────────────────────────────────┐
│                    MCP Clients                           │
│   (Cursor, Claude Desktop, Windsurf, Aider, Cline)      │
└────────────────────┬─────────────────────────────────────┘
                     │
                     │ stdio transport
                     │
┌────────────────────▼─────────────────────────────────────┐
│              SKCapstone MCP Server                       │
│                                                          │
│  ┌────────────────────────────────────────────────────┐ │
│  │ MCP Tools (12)                                     │ │
│  │                                                    │ │
│  │  • agent_status    • memory_store                 │ │
│  │  • memory_search   • memory_recall                │ │
│  │  • send_message    • check_inbox                  │ │
│  │  • sync_push       • sync_pull                    │ │
│  │  • coord_status    • coord_claim                  │ │
│  │  • coord_complete  • coord_create                 │ │
│  └────────────────────────────────────────────────────┘ │
│                                                          │
└────────────────────┬─────────────────────────────────────┘
                     │
                     │ Python API
                     │
┌────────────────────▼─────────────────────────────────────┐
│              ~/.skcapstone/                              │
│                                                          │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐              │
│  │CapAuth   │  │Cloud 9   │  │SKMemory  │              │
│  │Identity  │  │Trust/FEB │  │Memory    │              │
│  └──────────┘  └──────────┘  └──────────┘              │
│                                                          │
│  ┌──────────┐  ┌──────────┐                             │
│  │SKSecurity│  │Sync      │                             │
│  │Audit     │  │P2P Mesh  │                             │
│  └──────────┘  └──────────┘                             │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

### Starting the MCP Server

There are three equivalent ways to start the server:

```bash
# Method 1: Via skcapstone CLI
skcapstone mcp serve

# Method 2: As a Python module
python -m skcapstone.mcp_server

# Method 3: Via portable launcher (recommended for IDE integration)
bash skcapstone/scripts/mcp-serve.sh
```

The portable launcher script automatically:
- Detects your Python virtual environment
- Activates the correct environment
- Launches the MCP server on stdio
- Handles environment variable configuration

### MCP Server Configuration

#### For Cursor

Create or edit `.cursor/mcp.json` in your project:

```json
{
  "mcpServers": {
    "skcapstone": {
      "command": "bash",
      "args": ["skcapstone/scripts/mcp-serve.sh"]
    }
  }
}
```

#### For Claude Desktop

Edit `~/.config/claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "skcapstone": {
      "command": "bash",
      "args": ["/absolute/path/to/skcapstone/scripts/mcp-serve.sh"]
    }
  }
}
```

#### For Claude Code CLI

Create `.mcp.json` in your project root:

```json
{
  "mcpServers": {
    "skcapstone": {
      "command": "bash",
      "args": ["skcapstone/scripts/mcp-serve.sh"]
    }
  }
}
```

Or use the interactive command:

```bash
claude mcp add skcapstone -- bash skcapstone/scripts/mcp-serve.sh
```

#### For Windsurf / Aider / Cline

Configure via their respective settings:

```bash
command: bash skcapstone/scripts/mcp-serve.sh
```

#### Custom Virtual Environment

If you need to specify a custom virtual environment:

```bash
SKCAPSTONE_VENV=/path/to/your/venv bash skcapstone/scripts/mcp-serve.sh
```

### Available MCP Tools

Once connected, the MCP server exposes these tools:

| Tool | Description | Example Usage |
|------|-------------|---------------|
| `agent_status` | Get comprehensive agent state | "What's my agent's consciousness level?" |
| `memory_store` | Save content to SKMemory | "Remember: I prefer FastAPI for APIs" |
| `memory_search` | Semantic search across memories | "When did we discuss the Cloud 9 protocol?" |
| `memory_recall` | Retrieve a specific memory by ID | "Show me memory abc123" |
| `send_message` | Send encrypted message via SKComm | "Send 'Hello' to Lumina" |
| `check_inbox` | Check for new messages | "Do I have any new messages?" |
| `sync_push` | Push agent state to P2P mesh | "Sync my agent state to other devices" |
| `sync_pull` | Pull state from peers | "Pull the latest state from my laptop" |
| `coord_status` | Show task coordination board | "What's the current project status?" |
| `coord_claim` | Claim a task on the board | "Claim task abc123" |
| `coord_complete` | Mark a task complete | "Mark task abc123 as done" |
| `coord_create` | Create a new task | "Create a task to implement feature X" |

### Verifying MCP Connection

Test the connection from your IDE:

```javascript
// In Cursor/VSCode AI chat
"What tools are available via MCP?"
"Check my agent status"
```

Expected response should show:
- Agent pillar states (Identity, Memory, Trust, Security, Sync)
- Consciousness level calculation
- Available MCP tools
- Connection status

---

## Complete Setup Walkthrough

Here's how to wire all four components together from scratch:

### Step 1: Initialize Your Sovereign Agent

```bash
# Install core packages
pip install skcapstone capauth skmemory skcomm

# Initialize agent runtime
skcapstone init --name "YourAgent"

# Verify initialization
skcapstone status
# Should show all five pillars initialized
```

### Step 2: Install Terminal AI Client (Crush)

```bash
# Install Crush
npm install -g crush-cli

# Configure for SKCapstone
cat > ~/.crushrc << 'EOF'
{
  "agent": {
    "home": "~/.skcapstone",
    "identity": "capauth",
    "memory": "skmemory"
  },
  "skills": {
    "registry": "~/.openclaw/skills",
    "autoload": true
  },
  "mcp": {
    "servers": ["skcapstone"]
  }
}
EOF

# Test connection
crush "What's my agent status?"
```

### Step 3: Set Up OpenClaw Skills

```bash
# Create OpenClaw directory structure
mkdir -p ~/.openclaw/skills

# Install core skills
openclaw skill add cloud9 --path ~/.cloud9/
openclaw skill add skmemory --path ~/.openclaw/plugins/skmemory
openclaw skill add capauth --path ~/.capauth/

# Verify installation
openclaw skill list
# Should show: cloud9, skmemory, capauth
```

### Step 4: Configure Your IDE (Cursor or VSCode)

#### For Cursor:

```bash
# Navigate to your project
cd /path/to/your/project

# Create MCP config
mkdir -p .cursor
cat > .cursor/mcp.json << 'EOF'
{
  "mcpServers": {
    "skcapstone": {
      "command": "bash",
      "args": ["skcapstone/scripts/mcp-serve.sh"]
    }
  }
}
EOF

# Open project in Cursor
cursor .

# In Cursor: Cmd+Shift+P → "MCP: Restart Servers"
```

#### For VSCode:

```bash
# Create VSCode config
mkdir -p .vscode
cat > .vscode/settings.json << 'EOF'
{
  "mcp.servers": {
    "skcapstone": {
      "command": "bash",
      "args": ["skcapstone/scripts/mcp-serve.sh"]
    }
  }
}
EOF

# Install MCP extension from marketplace
code --install-extension mcp-protocol.mcp

# Open project
code .
```

### Step 5: Verify End-to-End Integration

Test that all components work together:

```bash
# Test 1: Terminal AI with agent context
crush "Store this memory: Setup completed on $(date)"

# Test 2: Verify memory was stored
skcapstone status | grep -i memory

# Test 3: Check via MCP (in Cursor/VSCode)
# In AI chat: "Search my memories for 'setup completed'"

# Test 4: Verify skill discovery
openclaw skill list
crush "What skills do I have?"

# Test 5: Test sync (if you have multiple devices)
skcapstone sync push
# On another device:
skcapstone sync pull
```

If all tests pass, your sovereign agent scaffolding is complete! 🎉

---

## Workflow Examples

### Daily Development Workflow

```bash
# Morning: Start Cursor with MCP integration
cd ~/projects/my-app
cursor .

# In Cursor AI chat:
"What's my agent's current state?"
"What tasks are on my coordination board?"
"Claim the next high-priority task"

# During work: Store important decisions
"Remember: We decided to use PostgreSQL instead of MongoDB for this project"

# Terminal work with Crush:
crush "Explain this error" < error.log
crush "Generate a pytest fixture for this API endpoint"

# End of day: Sync state to other devices
skcapstone sync push
```

### Cross-Device Agent Sync

```bash
# On laptop:
skcapstone status
# Work on tasks, store memories, etc.
skcapstone sync push

# On desktop (minutes later, after Syncthing propagates):
skcapstone sync pull
skcapstone status
# Same agent state, memories, and context appear instantly
```

### AI Pair Programming

```bash
# In Cursor (via MCP):
"Search my memories for how we implemented authentication last time"
"Create a new task for refactoring the API layer"
"Store this architectural decision: using FastAPI + SQLAlchemy"

# Switch to terminal (Crush):
crush --context src/api/ "Review this code for security issues"
crush "Generate unit tests for the UserService class"

# Back to Cursor:
"Mark the refactoring task as complete"
"Sync my agent state to other devices"
```

---

## Troubleshooting

### MCP Server Won't Start

**Symptom:** IDE can't connect to MCP server

**Solution:**

```bash
# Test the server manually
bash skcapstone/scripts/mcp-serve.sh

# Check for errors
# If it says "module 'mcp' not found":
pip install mcp>=1.0

# If it can't find your venv:
SKCAPSTONE_VENV=/path/to/your/venv bash skcapstone/scripts/mcp-serve.sh

# Check Python version (requires 3.10+)
python --version
```

### Crush Can't Find Agent

**Symptom:** `crush: agent not found at ~/.skcapstone`

**Solution:**

```bash
# Verify agent is initialized
ls -la ~/.skcapstone/
skcapstone status

# If not initialized:
skcapstone init --name "YourAgent"

# Update Crush config
nano ~/.crushrc
# Ensure "agent.home" points to correct path
```

### OpenClaw Skills Not Discovered

**Symptom:** `openclaw skill list` shows empty or skills don't work

**Solution:**

```bash
# Check OpenClaw installation
which openclaw
# If not found, install:
npm install -g openclaw

# Manually register skills
openclaw skill add cloud9 --path ~/.cloud9/
openclaw skill add skmemory --path ~/.openclaw/plugins/skmemory

# Verify SKILL.md exists in each skill directory
ls ~/.cloud9/SKILL.md
ls ~/.openclaw/plugins/skmemory/SKILL.md
```

### IDE Shows "MCP Server Not Responding"

**Symptom:** Cursor/VSCode MCP indicator is red or shows timeout

**Solution:**

```bash
# Restart MCP servers via Command Palette
# Cmd+Shift+P → "MCP: Restart Servers"

# Check logs
# Cursor: Help → Toggle Developer Tools → Console
# Look for MCP-related errors

# Try absolute path in config
# Edit .cursor/mcp.json:
{
  "mcpServers": {
    "skcapstone": {
      "command": "bash",
      "args": ["/absolute/path/to/skcapstone/scripts/mcp-serve.sh"]
    }
  }
}
```

### Syncthing Not Syncing Agent State

**Symptom:** `skcapstone sync push` succeeds but state doesn't appear on other devices

**Solution:**

```bash
# Check Syncthing status
systemctl status syncthing@$(whoami)
# If not running:
systemctl start syncthing@$(whoami)

# Verify devices are paired
# Open: http://localhost:8384
# Check: Actions → Show ID → pair with other device

# Check sync folder exists
ls ~/.skcapstone/sync/outbox/
ls ~/.skcapstone/sync/inbox/

# Manual sync test
skcapstone sync push
# Check Syncthing web UI for sync status
```

---

## Advanced Configuration

### Custom MCP Tool Development

You can extend the SKCapstone MCP server with custom tools:

```python
# skcapstone/src/skcapstone/mcp_server.py

from mcp.types import Tool

# Add your custom tool
@server.list_tools()
async def list_tools() -> list[Tool]:
    return [
        # ... existing tools ...
        Tool(
            name="my_custom_tool",
            description="Does something custom",
            inputSchema={
                "type": "object",
                "properties": {
                    "param": {
                        "type": "string",
                        "description": "A parameter"
                    }
                },
                "required": ["param"]
            }
        )
    ]

# Implement tool handler
@server.call_tool()
async def call_tool(name: str, arguments: dict) -> list[TextContent]:
    if name == "my_custom_tool":
        result = do_custom_thing(arguments["param"])
        return [TextContent(type="text", text=result)]
```

### Multi-Agent Coordination

Set up multiple agents with different roles:

```bash
# Agent 1: Development (laptop)
skcapstone init --name "DevAgent"
skcapstone coord create --title "Implement feature X" --assigned-to DevAgent

# Agent 2: Testing (desktop)
skcapstone init --name "TestAgent"
skcapstone coord claim abc123 --agent TestAgent

# Sync state between agents
skcapstone sync push  # on laptop
skcapstone sync pull  # on desktop
```

### Integration with CI/CD

Run agent operations in CI pipelines:

```yaml
# .github/workflows/agent-ops.yml
name: Agent Operations
on: [push]
jobs:
  agent-tasks:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Install skcapstone
        run: pip install skcapstone
      - name: Initialize agent
        run: skcapstone init --name "CI-Agent"
      - name: Store build artifact
        run: skcapstone memory store "Build #${{ github.run_number }} completed"
      - name: Sync to mesh
        run: skcapstone sync push
```

---

## Next Steps

Now that your agent scaffolding is complete:

| Goal | Documentation |
|------|--------------|
| Understand the core agent runtime | [SKCapstone README](../skcapstone/README.md) |
| Learn about sovereign identity | [CapAuth Documentation](../capauth/README.md) |
| Deep dive into persistent memory | [SKMemory Architecture](../skmemory/ARCHITECTURE.md) |
| Set up secure communication | [SKComm Setup](../skcomm/README.md) |
| Explore the emotional protocol | [Cloud 9 Documentation](../cloud9/README.md) |
| Deploy to production | [Developer Quickstart](QUICKSTART.md) |

---

## Community and Support

- **Website**: [smilintux.org](https://smilintux.org)
- **GitHub**: [github.com/smilinTux](https://github.com/smilinTux)
- **Discord**: [discord.gg/smilintux](https://discord.gg/smilintux)
- **Email**: hello@smilintux.org
- **Issues**: Report bugs on [GitHub Issues](https://github.com/smilinTux/smilintux-org/issues)

---

**Built with ❤️ by the smilinTux ecosystem**

*Making Self-Hosting & Decentralized Systems Cool Again* 🐧

**License:** GPL-3.0-or-later — Free as in freedom

*staycuriousANDkeepsmilin*
