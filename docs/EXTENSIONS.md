# Editor Extensions: Build, Package, and Publish

How to build and release the SKCapstone editor extensions for VSCode,
Cursor, and Neovim.

---

## Prerequisites (all extensions)

| Requirement | Version | Install |
|-------------|---------|---------|
| Node.js | >= 18 | `nvm install 18` or system package |
| npm | >= 9 | Ships with Node.js |
| skcapstone CLI | latest | `pip install -e ./skcapstone` |

Extension-specific requirements are listed in each section below.

---

## skcapstone-vscode

The primary VSCode extension. Provides an activity bar panel with agent
status, coordination board, and memory search.

### Additional prerequisites

| Tool | Install |
|------|---------|
| `@vscode/vsce` | `npm install -g @vscode/vsce` (or use the local devDependency) |
| VSCode Marketplace publisher | Create at https://marketplace.visualstudio.com/manage |
| Personal Access Token (PAT) | Azure DevOps PAT with Marketplace (Publish) scope |

### Build

```bash
cd skcapstone-vscode
npm install
npm run compile          # TypeScript -> out/extension.js
npm run lint             # ESLint check
npm run test             # Mocha test suite (requires VS Code)
```

### Package

```bash
npx vsce package         # produces skcapstone-<version>.vsix
```

The `vscode:prepublish` script runs `npm run compile` automatically
before packaging.

### Publish to VSCode Marketplace

```bash
# First time: login with your PAT
npx vsce login smilinTux

# Publish
npx vsce publish

# Or publish a specific version bump
npx vsce publish minor   # bumps 0.1.0 -> 0.2.0 and publishes
```

### Install from VSIX (local/testing)

```bash
code --install-extension skcapstone-0.1.0.vsix
```

---

## skcapstone-cursor

A VSCode-compatible extension targeting Cursor (and other VSCode forks
like Windsurf). Same build toolchain as the VSCode extension.

### Additional prerequisites

Same as skcapstone-vscode above (`@vscode/vsce`, PAT).

### Build

```bash
cd skcapstone-cursor
npm install
npm run compile
npm run lint
```

### Package

```bash
npx vsce package         # produces skcapstone-ide-<version>.vsix
```

### Publish

Cursor uses the Open VSX Registry (https://open-vsx.org) rather than
the Microsoft Marketplace:

```bash
# Install ovsx CLI
npm install -g ovsx

# Publish to Open VSX
ovsx publish skcapstone-ide-0.1.0.vsix -p <OPEN_VSX_TOKEN>
```

To get an Open VSX token: log in at https://open-vsx.org with GitHub,
then generate a token under Access Tokens.

Alternatively, Cursor can also sideload VSIX files directly:
1. Open Cursor
2. Cmd/Ctrl+Shift+P -> "Extensions: Install from VSIX..."
3. Select the .vsix file

### Note on publisher name

The Cursor extension uses publisher `smilintux` (lowercase) while the
VSCode extension uses `smilinTux`. Ensure the publisher field in
package.json matches the account you publish under.

---

## skcapstone-nvim

Neovim plugin written in Lua. No compilation step required.

### Additional prerequisites

| Tool | Version |
|------|---------|
| Neovim | >= 0.7 |
| plenary.nvim | Required for tests only |

### Structure

```
skcapstone-nvim/
  lua/skcapstone/init.lua   -- plugin entry point
  tests/
    minimal_init.lua         -- test harness init
    spec/                    -- plenary.nvim test specs
  Makefile                   -- test runner
```

### Build

No build step. Lua source is loaded directly by Neovim.

### Test

```bash
cd skcapstone-nvim
make test                # runs plenary.nvim test suite headlessly
```

Requires `nvim` on PATH. The Makefile auto-bootstraps plenary.nvim
into /tmp/plenary.nvim if not already present.

### Install (end users)

Via lazy.nvim:
```lua
{ "smilinTux/skcapstone-nvim", config = function() require("skcapstone").setup() end }
```

Via packer.nvim:
```lua
use { "smilinTux/skcapstone-nvim", config = function() require("skcapstone").setup() end }
```

### Publish

The Neovim plugin is distributed as a Git repository. No marketplace
packaging is needed. To release:

1. Tag the commit: `git tag v0.1.0`
2. Push the tag: `git push origin v0.1.0`
3. Users install directly from the repository URL

---

## CI/CD Considerations

- All three extensions should have their `version` fields bumped in
  lockstep (or independently if features diverge).
- The VSCode and Cursor extensions share the same build toolchain
  (TypeScript + vsce). A shared CI job can build both.
- Pre-publish checklist:
  1. `npm run lint` passes
  2. `npm run test` passes
  3. Version bumped in package.json
  4. CHANGELOG updated (if maintained)
  5. `npx vsce package` produces a valid .vsix
  6. Manual smoke test: install the .vsix and verify the activity bar
     panel loads, agent status displays, and memory search works.

---

## Troubleshooting

**"skcapstone: command not found" in the extension**

The extension shells out to the `skcapstone` CLI. Ensure it is
installed and on PATH. In VSCode, configure `skcapstone.cliPath` in
settings if it is installed in a non-standard location.

**vsce login fails**

Ensure your Azure DevOps PAT has the "Marketplace (Publish)" scope
and has not expired.

**Cursor does not see the extension**

Cursor reads from Open VSX, not the Microsoft Marketplace. Publish
to Open VSX or sideload the .vsix manually.
