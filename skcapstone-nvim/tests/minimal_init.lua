-- Minimal init for skcapstone-nvim plenary.nvim test runner.
--
-- Usage:
--   nvim --headless -u tests/minimal_init.lua \
--        -c "PlenaryBustedDirectory tests/spec/ {minimal_init = 'tests/minimal_init.lua'}"
--
-- CI (no pre-installed plenary):
--   The script auto-clones plenary into /tmp/plenary.nvim if missing.

-- Disable swap / shada noise
vim.opt.swapfile = false
vim.opt.shadafile = "NONE"

-- Add the plugin root (parent of tests/) to rtp so `require("skcapstone")` works.
local plugin_root = vim.fn.fnamemodify(debug.getinfo(1).source:sub(2), ":h:h")
vim.opt.rtp:prepend(plugin_root)

-- Locate or bootstrap plenary.nvim.
local plenary_candidates = {
  vim.fn.stdpath("data") .. "/lazy/plenary.nvim",
  vim.fn.stdpath("data") .. "/site/pack/packer/start/plenary.nvim",
  os.getenv("HOME") .. "/.local/share/nvim/lazy/plenary.nvim",
  "/tmp/plenary.nvim",
}

local plenary_found = false
for _, p in ipairs(plenary_candidates) do
  if vim.fn.isdirectory(p) == 1 then
    vim.opt.rtp:prepend(p)
    plenary_found = true
    break
  end
end

if not plenary_found then
  print("Bootstrapping plenary.nvim into /tmp/plenary.nvim …")
  vim.fn.system({
    "git", "clone", "--depth=1",
    "https://github.com/nvim-lua/plenary.nvim",
    "/tmp/plenary.nvim",
  })
  vim.opt.rtp:prepend("/tmp/plenary.nvim")
end
