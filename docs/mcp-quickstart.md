# Quick Reference: MCP Integration

## TL;DR

- **Cursor integration:** ✅ Already working (`.mcp.json` configured)
- **Crush integration:** ✅ Ready to use (install Crush, add config)
- **Shared agent:** Both connect to same skcapstone MCP server

---

## Cursor Setup (5 minutes)

### Already configured!

If you're in this repo, Cursor is already wired to skcapstone.

**Test it:**
1. Open Cursor
2. Open AI chat
3. Ask: "Check the agent status via MCP"
4. You should see: pillar states, consciousness level, sync status

**Add optional UI extension:**
```bash
cd skcapstone-cursor
npm install && npm run compile
code --install-extension .
```

---

## Crush Setup (10 minutes)

### 1. Install Crush

**macOS:**
```bash
brew install charmbracelet/tap/crush
```

**Linux (Debian/Ubuntu):**
```bash
curl -fsSL https://repo.charm.sh/apt/gpg.key | sudo gpg --dearmor -o /etc/apt/keyrings/charm.gpg
echo "deb [signed-by=/etc/apt/keyrings/charm.gpg] https://repo.charm.sh/apt/ * *" | sudo tee /etc/apt/sources.list.d/charm.list
sudo apt update && sudo apt install crush
```

**Linux (Fedora/RHEL):**
```bash
echo '[charm]
name=Charm
baseurl=https://repo.charm.sh/yum/
enabled=1
gpgcheck=1
gpgkey=https://repo.charm.sh/yum/gpg.key' | sudo tee /etc/yum.repos.d/charm.repo
sudo yum install crush
```

**Alternative (npm wrapper):**
```bash
npm install -g @charmland/crush
```

### 2. Configure MCP

Create `crush.json` in this repo:

```json
{
  "$schema": "https://charm.land/crush.json",
  "mcp": {
    "skcapstone": {
      "type": "stdio",
      "command": "bash",
      "args": ["skcapstone/scripts/mcp-serve.sh"]
    }
  },
  "lsp": {
    "python": {
      "command": "pyright-langserver",
      "args": ["--stdio"]
    }
  },
  "permissions": {
    "allowed_tools": [
      "view", "ls", "grep", "edit",
      "mcp_skcapstone_agent_status",
      "mcp_skcapstone_memory_search",
      "mcp_skcapstone_memory_store"
    ]
  }
}
```

### 3. Test it

```bash
crush

# In the Crush session:
crush> "What's my agent consciousness level?"
crush> "Store this in my memory: Crush integration tested"
crush> "Show me the coordination board"
```

---

## Common Operations

### Agent Status

**Cursor:**
```
Ask AI: "What's my agent consciousness level?"
```

**Crush:**
```bash
crush> "Check agent status"
```

**CLI:**
```bash
skcapstone status
```

### Store Memory

**Cursor:**
```
Ask AI: "Store this in my agent memory: [content]"
```

**Crush:**
```bash
crush> "Store this in my memory: Completed feature X"
```

**CLI:**
```bash
skcapstone memory store "Completed feature X" --tags=coding,feature
```

### Search Memories

**Cursor:**
```
Ask AI: "Search my memories for 'database migration'"
```

**Crush:**
```bash
crush> "Search my memories for 'database migration'"
```

**CLI:**
```bash
skcapstone memory search "database migration"
```

### Coordination Board

**Cursor:**
```
Ask AI: "Show me the coordination board"
```

**Crush:**
```bash
crush> "What tasks are on the coordination board?"
```

**CLI:**
```bash
skcapstone coord status
```

### Claim Task

**Cursor:**
```
Ask AI: "Claim task 80648efb for agent MCP-Builder"
```

**Crush:**
```bash
crush> "Claim task 80648efb for MCP-Builder"
```

**CLI:**
```bash
skcapstone coord claim 80648efb MCP-Builder
```

---

## Troubleshooting

### Cursor: "MCP server not responding"

```bash
# Test MCP server manually
bash skcapstone/scripts/mcp-serve.sh

# Should start and wait for JSON-RPC input
# Press Ctrl+C to exit

# Check Python venv
ls -la skcapstone/.venv/bin/python
ls -la skmemory/.venv/bin/python

# Verify mcp package installed
skcapstone/.venv/bin/python -c "import mcp; print('OK')"
```

### Crush: "MCP server skcapstone not responding"

```bash
# Check crush.json exists
cat crush.json

# Check MCP server works
bash skcapstone/scripts/mcp-serve.sh

# View Crush logs
crush logs --tail 50
```

### "Agent not initialized"

```bash
# Initialize agent
python -m skcapstone init --name "YourAgent"

# Verify
skcapstone status
```

---

## Hybrid Workflow

### Pattern: IDE + Terminal

1. **Start in Cursor:** Code generation, refactoring
2. **Switch to Terminal:** Quick scripts, automation
3. **Shared context:** Both see same memories, tasks, status

**Example:**

```
Cursor session:
  → Generate API endpoint
  → AI stores key decisions in memory
  → Mark task as in-progress

Terminal session:
  $ crush> "What did we work on in Cursor?"
  → AI recalls from shared memory
  $ crush> "Generate tests for the API endpoint"
  → AI has full context from Cursor
```

---

## Available MCP Tools

| Tool | Description |
|------|-------------|
| `agent_status` | Pillar states, consciousness level |
| `agent_context` | Full context dump (identity, memories, tasks) |
| `memory_store` | Store new memory |
| `memory_search` | Search memories by query |
| `memory_recall` | Recall specific memory by ID |
| `memory_curate` | Auto-tag, promote, dedupe memories |
| `session_capture` | Capture conversation as memories |
| `coord_status` | Show coordination board |
| `coord_claim` | Claim a task |
| `coord_complete` | Mark task done |
| `coord_create` | Create new task |
| `sync_push` | Push state to Syncthing mesh |
| `sync_pull` | Pull seeds from peers |
| `send_message` | Send message via SKComm |
| `check_inbox` | Check for new messages |
| `state_diff` | Show what changed since last sync |
| `ritual` | Memory Rehydration Ritual (boot context) |
| `soul_show` | Display soul blueprint |
| `anchor_show` | Display warmth anchor |
| `anchor_update` | Update warmth anchor |
| `journal_write` | Write session journal entry |
| `journal_read` | Read recent journal entries |
| `trust_graph` | Visualize trust web |
| `trust_calibrate` | Update trust thresholds |
| `germination` | Show germination prompts |

---

## Need Help?

- **Documentation:** [`docs/mcp-cursor-integration.md`](./mcp-cursor-integration.md)
- **Crush Guide:** [`docs/crush-integration.md`](./crush-integration.md)
- **Summary:** [`docs/mcp-integration-summary.md`](./mcp-integration-summary.md)
- **Issues:** [GitHub Issues](https://github.com/smilinTux/smilintux-org/issues)

---

**Status:** Both integrations are ready to use! 🎯
