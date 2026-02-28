# SKCapstone VSCode Extension

Sovereign agent integration for Visual Studio Code. View agent status, search memories, manage the coordination board, and inspect soul blueprints — all from the sidebar.

## Requirements

- [skcapstone CLI](https://github.com/smilintux-org/skcapstone) installed and on your PATH
- An initialized agent (`skcapstone status` should return valid JSON)

## Features

- **Agent Status** panel — identity, consciousness, singular status, pillars
- **Coordination Board** — open tasks sorted by priority with claim/complete
- **Memory Search** — full-text search across all memory layers
- **Memory Store** — save memories with importance and tags
- **Soul Blueprint** — view active soul traits, values, and boot message
- **Status Bar** — agent name and state always visible
- **Auto-Refresh** — configurable refresh interval (default: 30s)

## Installation

1. Clone this repository
2. `npm install && npm run compile`
3. Open the extension folder in VSCode
4. Press `F5` to launch the Extension Development Host

Or package it:

```bash
npm install -g @vscode/vsce
vsce package
code --install-extension skcapstone-0.1.0.vsix
```

## Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `skcapstone.cliPath` | `skcapstone` | Path to the skcapstone CLI binary |
| `skcapstone.agentName` | *(auto)* | Agent name for coordination operations |
| `skcapstone.autoRefresh` | `true` | Refresh status on activation |
| `skcapstone.refreshInterval` | `30` | Auto-refresh interval in seconds (0 to disable) |

## Commands

- `SKCapstone: Refresh Status` — refresh all panels
- `SKCapstone: Search Memory` — search agent memories
- `SKCapstone: Store Memory` — store a new memory
- `SKCapstone: Claim Task` — claim a coordination task
- `SKCapstone: Complete Task` — complete a coordination task
- `SKCapstone: Show Soul Blueprint` — view the active soul overlay

## License

GPL-3.0-or-later
