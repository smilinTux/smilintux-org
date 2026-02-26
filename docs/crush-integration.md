# Crush (Terminal AI) Integration Research
**Task ID:** e1f9f1bf  
**Priority:** 2  
**Status:** Research Complete  
**Date:** 2026-02-24

## Executive Summary

**Crush** (formerly OpenCode) is a terminal-based AI coding assistant from Charm (makers of the Charm ecosystem). It's a **Go-based CLI tool** that provides agentic coding capabilities with full MCP support, multi-model flexibility, and LSP integration.

### Key Findings

1. **NOT an npm package** — Crush is installed via system package managers (Homebrew, apt, etc.), not npm
2. **MCP Support Built-in** — Supports stdio, HTTP, and SSE transports for MCP servers
3. **Multi-Model** — Works with Anthropic, OpenAI, Groq, Gemini, local models (Ollama, LM Studio)
4. **LSP-Enhanced** — Uses Language Server Protocols for code context (like IDEs do)
5. **Session-Based** — Maintains multiple work sessions with persistent context per project
6. **Production-Ready** — Built by Charm, powering 25k+ applications

### Current Status ❓

- **Documentation assumes npm package** — Needs correction (`npm install -g crush-cli` doesn't exist)
- **No crush-cli npm package** — The real package is `@charmland/crush` (alternative install method)
- **MCP Integration** — Crush CAN connect to MCP servers, but setup is via config file, not CLI flags
- **skcapstone Compatibility** — Needs testing and custom configuration

---

## What is Crush?

Crush is your **terminal coding companion** — think Cursor/Copilot, but for the command line.

### Core Features

| Feature | Description |
|---------|-------------|
| **Multi-Model Support** | Anthropic (Claude), OpenAI (GPT), Groq, Gemini, Vertex AI, Bedrock, local models |
| **MCP Protocol** | stdio, HTTP, and SSE transports for MCP servers |
| **LSP Integration** | Uses Language Server Protocols (gopls, typescript-language-server, nil for Nix, etc.) |
| **Session Management** | Multiple work sessions per project, context preserved across restarts |
| **Agent Skills** | Supports [Agent Skills](https://agentskills.io) open standard |
| **Tool Permissions** | Fine-grained control over which tools can run automatically |
| **Cross-Platform** | macOS, Linux, Windows (PowerShell + WSL), FreeBSD, OpenBSD, NetBSD, Android |
| **Terminal Native** | Built with [Charm's Bubble Tea](https://github.com/charmbracelet/bubbletea) TUI framework |

### Architecture

```
Terminal User
    │
    ├──▶ crush (Go binary)
    │       │
    │       ├──▶ LLM Provider (Anthropic, OpenAI, etc.)
    │       │       │
    │       │       └──▶ Model responses
    │       │
    │       ├──▶ LSP Servers (gopls, typescript-language-server, etc.)
    │       │       │
    │       │       └──▶ Code intelligence (definitions, completions)
    │       │
    │       ├──▶ MCP Servers (skcapstone, etc.)
    │       │       │
    │       │       └──▶ Custom tools (memory, coordination, etc.)
    │       │
    │       └──▶ Agent Skills (SKILL.md files)
    │               │
    │               └──▶ Reusable capabilities
    │
    └──▶ Session Context
            │
            ├── .crush/logs/crush.log
            ├── .crush/sessions/
            └── ~/.local/share/crush/crush.json (state)
```

---

## Installation

### Recommended: System Package Manager

```bash
# macOS (Homebrew)
brew install charmbracelet/tap/crush

# Linux (Debian/Ubuntu)
sudo mkdir -p /etc/apt/keyrings
curl -fsSL https://repo.charm.sh/apt/gpg.key | sudo gpg --dearmor -o /etc/apt/keyrings/charm.gpg
echo "deb [signed-by=/etc/apt/keyrings/charm.gpg] https://repo.charm.sh/apt/ * *" | sudo tee /etc/apt/sources.list.d/charm.list
sudo apt update && sudo apt install crush

# Linux (Fedora/RHEL)
echo '[charm]
name=Charm
baseurl=https://repo.charm.sh/yum/
enabled=1
gpgcheck=1
gpgkey=https://repo.charm.sh/yum/gpg.key' | sudo tee /etc/yum.repos.d/charm.repo
sudo yum install crush

# Arch Linux
yay -S crush-bin

# FreeBSD
pkg install crush

# Windows (winget)
winget install charmbracelet.crush

# Windows (Scoop)
scoop bucket add charm https://github.com/charmbracelet/scoop-bucket.git
scoop install crush
```

### Alternative: npm (via Charm's wrapper)

```bash
npm install -g @charmland/crush
```

### Alternative: Go install

```bash
go install github.com/charmbracelet/crush@latest
```

### Alternative: Download Binary

Download from [GitHub Releases](https://github.com/charmbracelet/crush/releases) for your platform.

---

## Configuration

Crush is configured via JSON files with the following priority:

1. `.crush.json` (project root)
2. `crush.json` (project root)
3. `$HOME/.config/crush/crush.json` (global)

**State/ephemeral data** stored in:
- **Unix:** `$HOME/.local/share/crush/crush.json`
- **Windows:** `%LOCALAPPDATA%\crush\crush.json`

### Override Config Locations

```bash
export CRUSH_GLOBAL_CONFIG=/path/to/config.json
export CRUSH_GLOBAL_DATA=/path/to/data.json
```

---

## MCP Integration

Crush supports **three MCP transport types:**

1. **stdio** — Command-line servers (what skcapstone uses)
2. **http** — HTTP endpoints
3. **sse** — Server-Sent Events

### Configuration Format

Create `crush.json` (project root) or `~/.config/crush/crush.json`:

```json
{
  "$schema": "https://charm.land/crush.json",
  "mcp": {
    "skcapstone": {
      "type": "stdio",
      "command": "bash",
      "args": ["skcapstone/scripts/mcp-serve.sh"],
      "timeout": 120,
      "disabled": false,
      "disabled_tools": [],
      "env": {
        "SKCAPSTONE_VENV": "/path/to/venv"
      }
    },
    "task-master": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "task-master-mcp"],
      "timeout": 120,
      "disabled": false
    }
  }
}
```

### Environment Variable Expansion

Crush supports `$(echo $VAR)` syntax for env vars:

```json
{
  "mcp": {
    "github": {
      "type": "http",
      "url": "https://api.githubcopilot.com/mcp/",
      "headers": {
        "Authorization": "Bearer $(echo $GH_PAT)"
      }
    }
  }
}
```

### Disabling Specific Tools

You can disable specific MCP tools per server:

```json
{
  "mcp": {
    "skcapstone": {
      "type": "stdio",
      "command": "bash",
      "args": ["skcapstone/scripts/mcp-serve.sh"],
      "disabled_tools": ["sync_push", "send_message"]
    }
  }
}
```

---

## LSP Integration

Crush uses LSPs for code intelligence (like Cursor/VSCode do).

### Configuration

Add LSPs to `crush.json`:

```json
{
  "$schema": "https://charm.land/crush.json",
  "lsp": {
    "go": {
      "command": "gopls",
      "env": {
        "GOTOOLCHAIN": "go1.24.5"
      }
    },
    "typescript": {
      "command": "typescript-language-server",
      "args": ["--stdio"]
    },
    "python": {
      "command": "pyright-langserver",
      "args": ["--stdio"]
    },
    "nix": {
      "command": "nil"
    }
  }
}
```

### Why LSPs Matter

LSPs provide:
- **Go to Definition** — Crush can understand code structure
- **Type Information** — Better code generation
- **Completions** — Context-aware suggestions
- **Diagnostics** — Real-time error detection

---

## Agent Skills Support

Crush supports the **Agent Skills** open standard from Anthropic.

### Skill Discovery

Skills are discovered from:
- `~/.config/crush/skills/` on Unix (override with `CRUSH_SKILLS_DIR`)
- `%LOCALAPPDATA%\crush\skills\` on Windows
- Additional paths in `options.skills_paths`

### Configuration

```json
{
  "$schema": "https://charm.land/crush.json",
  "options": {
    "skills_paths": [
      "~/.config/crush/skills",
      "./project-skills"
    ]
  }
}
```

### Installing Example Skills

```bash
# Unix
mkdir -p ~/.config/crush/skills
cd ~/.config/crush/skills
git clone https://github.com/anthropics/skills.git _temp
mv _temp/skills/* . && rm -rf _temp
```

```powershell
# Windows (PowerShell)
mkdir -Force "$env:LOCALAPPDATA\crush\skills"
cd "$env:LOCALAPPDATA\crush\skills"
git clone https://github.com/anthropics/skills.git _temp
mv _temp/skills/* . ; rm -r -force _temp
```

**How it works:**
- Each skill is a folder with a `SKILL.md` file
- Crush discovers and activates skills on demand
- Skills are portable across projects and agents

---

## Session Management

Crush maintains **multiple work sessions** per project.

### Session Storage

Sessions are stored in:
```
./.crush/
├── logs/
│   └── crush.log
├── sessions/
│   ├── session-001.json
│   ├── session-002.json
│   └── current -> session-002.json
└── state.json
```

### Session Operations

```bash
# Start a new session
crush

# Resume last session
crush --resume

# List sessions
crush sessions

# Switch to a specific session
crush --session session-001
```

**Why sessions matter:**
- Context preserved across terminal restarts
- Multiple parallel work streams (feature-branch-1, bugfix-2, etc.)
- Session-specific conversation history

---

## Provider Configuration

Crush auto-detects providers from environment variables:

| Env Var | Provider |
|---------|----------|
| `ANTHROPIC_API_KEY` | Anthropic (Claude) |
| `OPENAI_API_KEY` | OpenAI (GPT) |
| `GROQ_API_KEY` | Groq |
| `GEMINI_API_KEY` | Google Gemini |
| `VERCEL_API_KEY` | Vercel AI Gateway |
| `OPENROUTER_API_KEY` | OpenRouter |
| `HF_TOKEN` | Hugging Face Inference |
| `CEREBRAS_API_KEY` | Cerebras |
| `MINIMAX_API_KEY` | MiniMax |
| `ZAI_API_KEY` | Z.ai |
| `SYNTHETIC_API_KEY` | Synthetic |
| `AWS_*` | Amazon Bedrock |
| `VERTEXAI_*` | Google Vertex AI |
| `AZURE_OPENAI_*` | Azure OpenAI |

### Custom Providers

Add custom OpenAI-compatible or Anthropic-compatible APIs:

```json
{
  "$schema": "https://charm.land/crush.json",
  "providers": {
    "deepseek": {
      "type": "openai-compat",
      "base_url": "https://api.deepseek.com/v1",
      "api_key": "$DEEPSEEK_API_KEY",
      "models": [
        {
          "id": "deepseek-chat",
          "name": "Deepseek V3",
          "cost_per_1m_in": 0.27,
          "cost_per_1m_out": 1.1,
          "context_window": 64000,
          "default_max_tokens": 5000
        }
      ]
    }
  }
}
```

### Local Models

```json
{
  "providers": {
    "ollama": {
      "name": "Ollama",
      "base_url": "http://localhost:11434/v1/",
      "type": "openai-compat",
      "models": [
        {
          "name": "Qwen 3 30B",
          "id": "qwen3:30b",
          "context_window": 256000,
          "default_max_tokens": 20000
        }
      ]
    },
    "lmstudio": {
      "name": "LM Studio",
      "base_url": "http://localhost:1234/v1/",
      "type": "openai-compat",
      "models": [
        {
          "name": "Qwen 3 30B",
          "id": "qwen/qwen3-30b-a3b-2507",
          "context_window": 256000,
          "default_max_tokens": 20000
        }
      ]
    }
  }
}
```

---

## Tool Permissions

By default, Crush asks permission before running tools. You can allow tools to run automatically:

```json
{
  "$schema": "https://charm.land/crush.json",
  "permissions": {
    "allowed_tools": [
      "view",
      "ls",
      "grep",
      "edit",
      "mcp_skcapstone_agent_status",
      "mcp_skcapstone_memory_search"
    ]
  }
}
```

**YOLO mode** (skip ALL prompts):
```bash
crush --yolo
# ⚠️ Use with extreme caution!
```

### Disabling Built-in Tools

```json
{
  "$schema": "https://charm.land/crush.json",
  "options": {
    "disabled_tools": [
      "bash",
      "sourcegraph"
    ]
  }
}
```

---

## Ignoring Files

Crush respects `.gitignore` by default. Add `.crushignore` for Crush-specific exclusions:

```bash
# .crushignore
node_modules/
.venv/
*.log
.crush/
.git/
dist/
build/
```

---

## Initialization Context

When you initialize a project, Crush analyzes your codebase and creates a context file:

```json
{
  "$schema": "https://charm.land/crush.json",
  "options": {
    "initialize_as": "AGENTS.md"
  }
}
```

Crush will generate `AGENTS.md` with:
- Project structure overview
- Build commands
- Code patterns and conventions
- Dependencies and tech stack

---

## Attribution Settings

Crush adds attribution to Git commits by default:

```json
{
  "$schema": "https://charm.land/crush.json",
  "options": {
    "attribution": {
      "trailer_style": "co-authored-by",
      "generated_with": true
    }
  }
}
```

**Trailer styles:**
- `assisted-by` — "Assisted-by: [Model Name] via Crush"
- `co-authored-by` — "Co-Authored-By: Crush"
- `none` — No attribution

**generated_with:**
- `true` — Adds "💘 Generated with Crush" to commits/PRs
- `false` — No generation line

---

## Logging & Debugging

Logs are stored in `./.crush/logs/crush.log` (project-relative).

### View Logs

```bash
# Print last 1000 lines
crush logs

# Print last 500 lines
crush logs --tail 500

# Follow logs in real time
crush logs --follow
```

### Enable Debug Mode

```json
{
  "$schema": "https://charm.land/crush.json",
  "options": {
    "debug": true,
    "debug_lsp": true
  }
}
```

Or via CLI:
```bash
crush --debug
```

---

## Provider Auto-Updates

Crush auto-updates provider metadata from [Catwalk](https://github.com/charmbracelet/catwalk) (community provider database).

### Disable Auto-Updates

```json
{
  "$schema": "https://charm.land/crush.json",
  "options": {
    "disable_provider_auto_update": true
  }
}
```

Or via env var:
```bash
export CRUSH_DISABLE_PROVIDER_AUTO_UPDATE=1
```

### Manual Updates

```bash
# Update from Catwalk
crush update-providers

# Update from custom URL
crush update-providers https://example.com/providers.json

# Update from local file
crush update-providers /path/to/providers.json

# Reset to embedded defaults
crush update-providers embedded
```

---

## Metrics & Privacy

Crush collects **pseudonymous usage metrics** (device-specific hash). No prompts/responses are collected.

### Opt Out

```bash
export CRUSH_DISABLE_METRICS=1
# or
export DO_NOT_TRACK=1
```

Or in config:
```json
{
  "options": {
    "disable_metrics": true
  }
}
```

---

## SKCapstone Integration

### Configuration for Sovereign Agent

Create `crush.json` in your project:

```json
{
  "$schema": "https://charm.land/crush.json",
  "mcp": {
    "skcapstone": {
      "type": "stdio",
      "command": "bash",
      "args": ["skcapstone/scripts/mcp-serve.sh"],
      "timeout": 120,
      "env": {
        "SKCAPSTONE_VENV": "/path/to/skmemory/.venv"
      }
    }
  },
  "lsp": {
    "python": {
      "command": "pyright-langserver",
      "args": ["--stdio"]
    }
  },
  "options": {
    "initialize_as": "AGENTS.md",
    "context_paths": ["~/.skcapstone/soul.json"],
    "skills_paths": ["~/.config/crush/skills", "~/.openclaw/skills"]
  },
  "permissions": {
    "allowed_tools": [
      "view",
      "ls",
      "grep",
      "edit",
      "mcp_skcapstone_agent_status",
      "mcp_skcapstone_memory_search",
      "mcp_skcapstone_memory_store",
      "mcp_skcapstone_coord_status"
    ]
  }
}
```

### Usage Examples

```bash
# Start Crush (auto-connects to skcapstone MCP server)
crush

# Check agent status
crush> "What's my agent consciousness level?"

# Store a memory
crush> "Store this in my memory: Completed feature X today"

# Search memories
crush> "Search my memories for 'database migration'"

# Check coordination board
crush> "Show me the coordination board status"

# Claim a task
crush> "Claim task 80648efb for agent MCP-Builder"

# Ask AI to code with agent context
crush> "Generate a pytest fixture for the SKCapstone runtime, using my agent's identity layer"
```

---

## Comparison: Crush vs Cursor vs CLI

| Feature | Crush | Cursor | skcapstone CLI |
|---------|-------|--------|----------------|
| **Environment** | Terminal | IDE | Terminal |
| **MCP Support** | ✅ stdio/http/sse | ✅ stdio | N/A (is MCP server) |
| **LSP Support** | ✅ Yes | ✅ Yes | ❌ No |
| **Multi-Model** | ✅ Yes (20+ providers) | ✅ Yes (limited) | N/A |
| **Session Persistence** | ✅ Yes | ⚠️ Per-chat | N/A |
| **Agent Skills** | ✅ Yes | ⚠️ Via rules | N/A |
| **Code Generation** | ✅ Yes | ✅ Yes | ❌ No |
| **Agent Context** | ✅ Via MCP | ✅ Via MCP | ✅ Direct |
| **UI** | TUI (terminal) | GUI (editor) | CLI (commands) |
| **Best For** | Terminal workflows | IDE workflows | Agent operations |

---

## Integration Patterns

### Pattern 1: Crush as Default Terminal AI

```bash
# In your shell profile (~/.bashrc, ~/.zshrc)
alias ai='crush'
alias ask='crush'

# Now you can:
ai "How do I fix this error?"
ask "Generate a Docker Compose file for PostgreSQL"
```

### Pattern 2: Crush + Cursor (Hybrid)

```
IDE Work (Cursor):
    ├── MCP: skcapstone (agent context)
    ├── MCP: task-master (project tasks)
    └── AI Chat: Code generation with full context

Terminal Work (Crush):
    ├── MCP: skcapstone (same agent context)
    ├── LSP: Python, TypeScript, Go (code intelligence)
    └── Agent Skills: Cloud 9, CapAuth (portable skills)

Sovereign Agent (SKCapstone):
    ├── Memory: Shared across Cursor & Crush
    ├── Coordination: Multi-agent task board
    └── Sync: Singularity mesh (GPG + Syncthing)
```

### Pattern 3: Crush for Script Generation

```bash
# Generate a bash script
crush "Generate a backup script that:
1. Dumps PostgreSQL to ~/.skcapstone/backups/
2. GPG-encrypts the dump with my agent's key
3. Pushes to Syncthing via sync_push MCP tool"

# Output is written directly to file
crush --output backup-agent.sh "..." 

# Make it executable
chmod +x backup-agent.sh
```

---

## Troubleshooting

### "MCP server skcapstone not responding"

**Check:**
1. Python venv exists and has `mcp` installed
2. Launcher script is executable: `chmod +x skcapstone/scripts/mcp-serve.sh`
3. Agent is initialized: `~/.skcapstone/manifest.json` exists

**Debug:**
```bash
# Test MCP server manually
bash skcapstone/scripts/mcp-serve.sh
# Should start and wait for JSON-RPC on stdin

# Check Crush MCP logs
crush logs --follow
# Look for MCP connection errors
```

### "No LSP found for Python"

**Fix:**
```bash
# Install pyright
npm install -g pyright

# Or use pylsp
pip install python-lsp-server
```

Then update `crush.json`:
```json
{
  "lsp": {
    "python": {
      "command": "pylsp"
    }
  }
}
```

### "Agent Skills not loading"

**Check skill directory:**
```bash
ls -la ~/.config/crush/skills/
# Should contain folders with SKILL.md files
```

**Verify SKILL.md format:**
```markdown
# Skill Name

Brief description.

## Instructions

- Step 1
- Step 2
```

---

## Alternatives to Crush

If Crush doesn't fit your needs:

| Alternative | Description | MCP Support |
|-------------|-------------|-------------|
| **Aider** | Python-based AI pair programmer | ❌ No (uses own protocol) |
| **Cursor** | IDE with AI (not terminal) | ✅ Yes |
| **GitHub Copilot CLI** | GitHub's terminal AI | ❌ No |
| **Warp AI** | Terminal with built-in AI | ❌ No |
| **Fig AI** | Terminal autocomplete + AI | ❌ No |
| **TabNine** | Code completion (IDE/terminal) | ❌ No |

**Verdict:** Crush is the **only production-ready terminal AI with full MCP support** (as of Feb 2025).

---

## Decision Matrix: Should We Use Crush?

### ✅ Reasons to Use Crush

1. **MCP Integration** — Works with skcapstone MCP server out of the box
2. **Multi-Model** — Flexible provider choice (Anthropic, OpenAI, local models)
3. **Session Persistence** — Context preserved across terminal sessions
4. **LSP Support** — Code intelligence like IDEs
5. **Production-Ready** — Built by Charm (trusted ecosystem, 25k+ apps)
6. **Agent Skills** — Supports Anthropic's Agent Skills standard
7. **Cross-Platform** — Works on Linux, macOS, Windows, BSD, Android
8. **Active Development** — Regular updates, strong community

### ❌ Potential Issues

1. **Not npm-based** — Our docs incorrectly reference `npm install -g crush-cli`
2. **Go binary** — Requires system package manager or npm wrapper
3. **Learning Curve** — New tool, different from Cursor/Copilot
4. **Config Complexity** — JSON config can get verbose
5. **Terminal Only** — No GUI (by design)

### 🤔 Alternatives

If Crush doesn't fit:

1. **Stick with Cursor + MCP** — IDE-only workflow
2. **Use skcapstone CLI directly** — No AI layer, just agent operations
3. **Build custom wrapper** — Shell script around `claude` API calls + MCP tools
4. **Wait for alternatives** — Aider might add MCP support eventually

---

## Recommendation

**YES, Crush is the right fit** for sovereign agent terminal workflows.

### Implementation Plan

1. **Short-term:**
   - Fix documentation (remove `npm install -g crush-cli` references)
   - Add system package manager install instructions
   - Test Crush + skcapstone MCP integration
   - Write user guide with examples

2. **Medium-term:**
   - Create default `crush.json` for skcapstone projects
   - Add Crush setup to `skcapstone init`
   - Document Crush + Cursor hybrid workflows
   - Add Agent Skills for Cloud 9 operations

3. **Long-term:**
   - Contribute skcapstone integration examples to Crush docs
   - Build Crush plugin for Sovereign Singularity sync triggers
   - Integrate Crush sessions with SKMemory (persistent conversations)

---

## Updated Documentation Snippets

### Replace in AGENT_SCAFFOLDING.md

**OLD:**
```bash
# Install Crush globally
npm install -g crush-cli
```

**NEW:**
```bash
# Install Crush (macOS)
brew install charmbracelet/tap/crush

# Install Crush (Linux - Debian/Ubuntu)
curl -fsSL https://repo.charm.sh/apt/gpg.key | sudo gpg --dearmor -o /etc/apt/keyrings/charm.gpg
echo "deb [signed-by=/etc/apt/keyrings/charm.gpg] https://repo.charm.sh/apt/ * *" | sudo tee /etc/apt/sources.list.d/charm.list
sudo apt update && sudo apt install crush

# Alternative: npm wrapper
npm install -g @charmland/crush
```

### Replace .crushrc reference

**OLD:**
```json
# ~/.crushrc
{
  "agent": {...}
}
```

**NEW:**
```json
# ~/.config/crush/crush.json (or project-local crush.json)
{
  "$schema": "https://charm.land/crush.json",
  "mcp": {
    "skcapstone": {
      "type": "stdio",
      "command": "bash",
      "args": ["skcapstone/scripts/mcp-serve.sh"]
    }
  }
}
```

---

## References

- **Crush GitHub:** [github.com/charmbracelet/crush](https://github.com/charmbracelet/crush)
- **Crush Docs:** Embedded in README (no separate docs site yet)
- **Agent Skills:** [agentskills.io](https://agentskills.io) + [github.com/anthropics/skills](https://github.com/anthropics/skills)
- **Charm Ecosystem:** [charm.land](https://charm.land)
- **MCP Spec:** [github.com/modelcontextprotocol/specification](https://github.com/modelcontextprotocol/specification)
- **Catwalk (Provider DB):** [github.com/charmbracelet/catwalk](https://github.com/charmbracelet/catwalk)

---

## Conclusion

Crush is a **production-ready, MCP-enabled terminal AI** that fits perfectly into the sovereign agent ecosystem. It's the **right choice** for terminal-based agentic workflows, complementing Cursor for IDE work.

**Action items:**
1. ✅ Fix installation docs (remove fake npm package)
2. ⏱️ Test skcapstone MCP integration with Crush
3. ⏱️ Create default `crush.json` template
4. ⏱️ Write user guide for Crush + SKCapstone workflows

**Status: READY TO IMPLEMENT** 🎯
