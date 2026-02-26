# VS Code / OpenCode — SKCapstone context

Load this context when using VS Code, Cursor, or OpenCode (Crush) so the AI and you have the sovereign agent in mind.

## Session startup (run at start of each session)

```bash
skcapstone trust rehydrate
skcapstone sync pull
skcapstone status
```

## Getting `skcapstone` on PATH (this repo)

- **With pip:** `pip install -e skcapstone/` (use `skcapstone` when the venv is active).
- **Without installing (dev from repo):**
  ```bash
  # macOS / Linux (bash/zsh):
  export PATH="$(pwd)/skcapstone/scripts:$PATH"

  # Windows (PowerShell):
  $Env:Path = "$PWD\\skcapstone\\scripts;" + $Env:Path

  # Windows (cmd.exe):
  set PATH=%CD%\\skcapstone\\scripts;%PATH%
  ```
  Or run `./skcapstone/scripts/skcapstone <cmd>` (requires bash on Windows, e.g. Git Bash or WSL).

## Essential commands

| Command | Purpose |
|--------|---------|
| `skcapstone status` | Full pillar status |
| `skcapstone memory list` | Recent memories |
| `skcapstone coord status` | Coordination board |
| `skcapstone context generate --target claude-md` | Regenerate CLAUDE.md |
| `skcapstone context generate --target cursor-rules` | Regenerate .cursor/rules/agent.mdc |

## Optional: use this file inside VS Code

If you use VS Code and want this content in your workspace, copy it to `.vscode/skcapstone-context.md` (the `.vscode` folder is gitignored; create it locally). You can also open this file from the repo: `docs/VSCODE_SKCAPSTONE_CONTEXT.md`.
