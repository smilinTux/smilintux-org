# SKCapstone Cursor/IDE Extension

Sovereign agent integration for Cursor, VSCode, Windsurf, and any VSCode-based editor. Communicates with the agent via `python -m skcapstone.cli` with automatic Python environment detection.

## Requirements

- Python 3.11+ with `skcapstone` package installed
- An initialized agent (`skcapstone status` should work)

## Features

- **Agent Status** panel — identity, consciousness, singular, pillars
- **Coordination Board** — prioritized task list with claim actions
- **Memory Store & Search** — persistent memory operations
- **Sync Push** — push agent state to the sync mesh
- **Status Bar** — agent name and consciousness state
- **Smart Python Detection** — finds the right Python interpreter automatically

## Python Detection

The extension searches for Python in this order:

1. `skcapstone.pythonPath` setting
2. `SKCAPSTONE_PYTHON` environment variable
3. Workspace venvs: `skmemory/.venv`, `skcapstone/.venv`, `.venv`
4. System `python3` or `python`

## Installation

1. Clone this repository
2. `npm install && npm run compile`
3. Open in your editor and press `F5` for the Extension Development Host

Or package:

```bash
npm install -g @vscode/vsce
vsce package
```

## Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `skcapstone.pythonPath` | *(auto)* | Path to Python with skcapstone installed |
| `skcapstone.agentHome` | `~/.skcapstone` | Override the agent home directory |
| `skcapstone.refreshOnStartup` | `true` | Auto-refresh on editor activation |

## Commands

- `SKCapstone: Agent Status` — show agent status
- `SKCapstone: Store Memory` — store a new memory
- `SKCapstone: Search Memory` — search agent memories
- `SKCapstone: Coordination Board` — view the task board
- `SKCapstone: Claim Task` — claim a task
- `SKCapstone: Sync Push` — push state to sync mesh
- `SKCapstone: Refresh` — refresh all panels

## License

GPL-3.0-or-later
