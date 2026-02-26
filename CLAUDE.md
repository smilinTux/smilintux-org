# SKCapstone Agent Context (Claude Code)

This project uses **SKCapstone** — the sovereign agent runtime (identity, memory, trust, security, sync). Agent home: `~/.skcapstone/`.

## Session startup (run at the start of every new session)

```bash
skcapstone trust rehydrate
skcapstone sync pull
skcapstone status
```

## Getting `skcapstone` on PATH (this repo)

- **With pip:** `pip install -e skcapstone/` (then use `skcapstone` when venv is active).
- **Without installing (dev from repo):** Add the CLI wrapper to PATH:
  ```bash
  # macOS / Linux (bash/zsh):
  export PATH="$(pwd)/skcapstone/scripts:$PATH"

  # Windows (PowerShell):
  $Env:Path = "$PWD\\skcapstone\\scripts;" + $Env:Path

  # Windows (cmd.exe):
  set PATH=%CD%\\skcapstone\\scripts;%PATH%
  ```
  Or run: `./skcapstone/scripts/skcapstone status` (requires bash on Windows, e.g. Git Bash or WSL).

## Quick reference

```bash
skcapstone status                  # Full pillar status
skcapstone memory list             # Recent memories
skcapstone memory store "..."      # Store a memory
skcapstone coord status            # Coordination board
skcapstone context generate --target claude-md   # Regenerate this file with live context
```

## Full context

To fill this file with **live** agent context (pillars, board, memories), run from repo root:

```bash
skcapstone context generate --target claude-md
```

That overwrites this file with current identity, pillar status, coordination board, and recent memories.
