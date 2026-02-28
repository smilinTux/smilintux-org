# SKCapstone Neovim Plugin

Sovereign agent integration for Neovim. Agent status, memory search, coordination board, and soul blueprints in floating windows.

## Requirements

- Neovim 0.7+
- [skcapstone CLI](https://github.com/smilintux-org/skcapstone) installed and on your PATH

## Installation

### lazy.nvim

```lua
{
  "smilinTux/skcapstone-nvim",
  config = function()
    require("skcapstone").setup()
  end,
}
```

### packer.nvim

```lua
use {
  "smilinTux/skcapstone-nvim",
  config = function()
    require("skcapstone").setup()
  end,
}
```

## Configuration

```lua
require("skcapstone").setup({
  cli_path = "skcapstone",    -- path to skcapstone CLI
  agent_name = "",            -- agent name for coord ops (default: "nvim-agent")
  float_width = 60,           -- floating window width
  float_height = 20,          -- floating window height
})
```

## Commands

| Command | Description |
|---------|-------------|
| `:SKStatus` | Show agent status (identity, pillars, soul) |
| `:SKCoord` | Show the coordination board |
| `:SKMemory [query]` | Search agent memories (prompts if no query) |
| `:SKClaim [id]` | Claim a coordination task |
| `:SKComplete [id]` | Complete a coordination task |
| `:SKSoul` | Show the active soul blueprint |

All commands display results in a centered floating window. Press `q` or `Esc` to close.

## License

GPL-3.0-or-later
