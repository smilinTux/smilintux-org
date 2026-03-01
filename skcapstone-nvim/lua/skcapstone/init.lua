-- SKCapstone Neovim Plugin
-- Sovereign agent status, memory search, coordination board.
--
-- Install: add to lazy.nvim or packer:
--   { "smilinTux/skcapstone-nvim" }
--
-- Commands:
--   :SKStatus       - Show agent status in a floating window
--   :SKCoord        - Show coordination board
--   :SKMemory <q>   - Search agent memories
--   :SKClaim <id>   - Claim a task
--   :SKComplete <id> - Complete a task
--   :SKSoul         - Show soul blueprint

local M = {}

-- Configuration
M.config = {
  cli_path = "skcapstone",
  agent_name = "",
  float_width = 60,
  float_height = 20,
}

--- Run a skcapstone CLI command and return parsed JSON.
--- @param args string[] CLI arguments
--- @return table|nil result Parsed JSON or nil on error
--- @return string|nil error Error message
function M.run(args)
  local cmd = { M.config.cli_path }
  for _, a in ipairs(args) do
    table.insert(cmd, a)
  end

  -- Wrap vim.system() in pcall so a missing binary or unavailable API
  -- produces a friendly error instead of a Lua traceback.
  local sys_ok, sys_result = pcall(function()
    return vim.system(cmd, { text = true }):wait()
  end)

  if not sys_ok then
    local msg = type(sys_result) == "string" and sys_result or "Failed to run skcapstone CLI"
    return nil, msg
  end

  local result = sys_result

  if result.code ~= 0 then
    return nil, result.stderr or "Command failed"
  end

  local ok, data = pcall(vim.json.decode, result.stdout)
  if ok then
    return data, nil
  end
  return result.stdout, nil
end

--- Create a floating window with content lines.
--- @param title string Window title
--- @param lines string[] Content lines
function M.float(title, lines)
  local buf = vim.api.nvim_create_buf(false, true)
  vim.api.nvim_buf_set_lines(buf, 0, -1, false, lines)
  vim.bo[buf].modifiable = false
  vim.bo[buf].buftype = "nofile"
  vim.bo[buf].filetype = "skcapstone"

  local width = math.min(M.config.float_width, vim.o.columns - 4)
  local height = math.min(#lines + 2, M.config.float_height)

  local win = vim.api.nvim_open_win(buf, true, {
    relative = "editor",
    width = width,
    height = height,
    col = math.floor((vim.o.columns - width) / 2),
    row = math.floor((vim.o.lines - height) / 2),
    style = "minimal",
    border = "rounded",
    title = " " .. title .. " ",
    title_pos = "center",
  })

  -- Close on q or Escape
  vim.keymap.set("n", "q", "<cmd>close<cr>", { buffer = buf })
  vim.keymap.set("n", "<Esc>", "<cmd>close<cr>", { buffer = buf })

  return buf, win
end

--- Show agent status in a floating window.
function M.status()
  local data, err = M.run({ "status", "--format", "json" })
  if err then
    vim.notify("SKCapstone: " .. err, vim.log.levels.ERROR)
    return
  end

  local lines = {
    "Agent: " .. (data.name or "unknown"),
    "Conscious: " .. (data.conscious and "YES" or "NO"),
    "Singular: " .. (data.singular and "YES" or "NO"),
    "Fingerprint: " .. (data.fingerprint or "none"),
    "Soul: " .. (data.active_soul or "none"),
    "",
    "── Pillars ──",
  }

  if data.pillars then
    for name, status in pairs(data.pillars) do
      local icon = status:find("ok") and "✓" or "✗"
      table.insert(lines, string.format("  %s %s: %s", icon, name, status))
    end
  end

  M.float("SKCapstone Status", lines)
end

--- Show coordination board.
function M.coord()
  local data, err = M.run({ "coord", "status", "--format", "json" })
  if err then
    vim.notify("SKCapstone: " .. err, vim.log.levels.ERROR)
    return
  end

  local tasks = data.tasks or data or {}
  local lines = { "── Coordination Board ──", "" }

  local priority_icons = {
    critical = "🔥",
    high = "↑",
    medium = "─",
    low = "↓",
  }

  for _, t in ipairs(tasks) do
    if t.status ~= "done" and t.status ~= "completed" then
      local icon = priority_icons[t.priority] or "·"
      table.insert(
        lines,
        string.format(
          "%s [%s] %s %s",
          icon,
          (t.id or ""):sub(1, 8),
          t.title or "",
          t.assigned_to and ("→ " .. t.assigned_to) or ""
        )
      )
    end
  end

  if #lines == 2 then
    table.insert(lines, "  No open tasks")
  end

  M.float("Coordination Board", lines)
end

--- Search agent memories.
--- @param query string Search query
function M.memory_search(query)
  if not query or query == "" then
    query = vim.fn.input("Search memories: ")
    if query == "" then
      return
    end
  end

  local data, err = M.run({ "memory", "search", query, "--format", "json" })
  if err then
    vim.notify("SKCapstone: " .. err, vim.log.levels.ERROR)
    return
  end

  local results = data.results or data or {}
  local lines = { "── Memory Search: " .. query .. " ──", "" }

  for _, m in ipairs(results) do
    local layer = m.layer or ""
    local content = (m.content or ""):sub(1, 80)
    table.insert(lines, string.format("[%s] %s", layer, content))
    if m.tags and #m.tags > 0 then
      table.insert(lines, "  tags: " .. table.concat(m.tags, ", "))
    end
    table.insert(lines, "")
  end

  if #results == 0 then
    table.insert(lines, "  No results found")
  end

  M.float("Memory Search", lines)
end

--- Claim a coordination task.
--- @param task_id string Task ID
function M.claim(task_id)
  if not task_id or task_id == "" then
    task_id = vim.fn.input("Task ID to claim: ")
    if task_id == "" then
      return
    end
  end

  local agent = M.config.agent_name ~= "" and M.config.agent_name or "nvim-agent"
  local _, err = M.run({ "coord", "claim", task_id, "--agent", agent })
  if err then
    vim.notify("SKCapstone: " .. err, vim.log.levels.ERROR)
  else
    vim.notify("Claimed task " .. task_id, vim.log.levels.INFO)
  end
end

--- Complete a coordination task.
--- @param task_id string Task ID
function M.complete(task_id)
  if not task_id or task_id == "" then
    task_id = vim.fn.input("Task ID to complete: ")
    if task_id == "" then
      return
    end
  end

  local agent = M.config.agent_name ~= "" and M.config.agent_name or "nvim-agent"
  local _, err = M.run({ "coord", "complete", task_id, "--agent", agent })
  if err then
    vim.notify("SKCapstone: " .. err, vim.log.levels.ERROR)
  else
    vim.notify("Completed task " .. task_id, vim.log.levels.INFO)
  end
end

--- Show soul blueprint.
function M.soul()
  local data, err = M.run({ "soul", "show", "--format", "json" })
  if err then
    vim.notify("SKCapstone: " .. err, vim.log.levels.ERROR)
    return
  end

  local lines = {
    "── Soul Blueprint ──",
    "",
    "Name: " .. (data.name or ""),
    "Title: " .. (data.title or ""),
    "",
    "Traits:",
  }

  for _, t in ipairs(data.traits or {}) do
    table.insert(lines, "  · " .. t)
  end

  table.insert(lines, "")
  table.insert(lines, "Values:")
  for _, v in ipairs(data.values or {}) do
    table.insert(lines, "  · " .. v)
  end

  if data.boot_message then
    table.insert(lines, "")
    table.insert(lines, "Boot Message:")
    table.insert(lines, data.boot_message)
  end

  M.float("Soul Blueprint", lines)
end

--- Setup function for lazy.nvim / packer.
--- @param opts table|nil User configuration
function M.setup(opts)
  M.config = vim.tbl_deep_extend("force", M.config, opts or {})

  -- Register commands
  vim.api.nvim_create_user_command("SKStatus", function()
    M.status()
  end, { desc = "Show SKCapstone agent status" })

  vim.api.nvim_create_user_command("SKCoord", function()
    M.coord()
  end, { desc = "Show coordination board" })

  vim.api.nvim_create_user_command("SKMemory", function(cmd)
    M.memory_search(cmd.args)
  end, { nargs = "?", desc = "Search agent memories" })

  vim.api.nvim_create_user_command("SKClaim", function(cmd)
    M.claim(cmd.args)
  end, { nargs = "?", desc = "Claim a coordination task" })

  vim.api.nvim_create_user_command("SKComplete", function(cmd)
    M.complete(cmd.args)
  end, { nargs = "?", desc = "Complete a coordination task" })

  vim.api.nvim_create_user_command("SKSoul", function()
    M.soul()
  end, { desc = "Show soul blueprint" })
end

return M
