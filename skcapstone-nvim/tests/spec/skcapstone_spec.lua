-- skcapstone-nvim test suite (plenary.nvim / busted style)
--
-- Run:
--   nvim --headless -u tests/minimal_init.lua \
--        -c "PlenaryBustedDirectory tests/spec/ {minimal_init = 'tests/minimal_init.lua'}"
--
-- Mocks:
--   vim.system()       — replaced per-test to return controlled {code, stdout, stderr}
--   vim.notify()       — replaced per-test to capture notification calls
--   skcapstone.float() — monkey-patched to capture float calls without opening windows

local describe = describe
local it = it
local before_each = before_each
local assert = require("luassert")

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

--- Build a fake vim.system that returns the given stdout / code / stderr.
local function make_system(stdout, code, stderr)
  code   = code   or 0
  stderr = stderr or ""
  return function(_cmd, _opts)
    return {
      wait = function()
        return { code = code, stdout = stdout, stderr = stderr }
      end,
    }
  end
end

--- Encode a Lua table to JSON (uses nvim's built-in encoder).
local function enc(t)
  return vim.json.encode(t)
end

-- ---------------------------------------------------------------------------
-- Suite
-- ---------------------------------------------------------------------------

describe("skcapstone", function()
  local sk

  -- Captured call lists, reset before each test.
  local notify_calls
  local float_calls

  before_each(function()
    -- Reload the module fresh for every test so state doesn't leak.
    package.loaded["skcapstone"] = nil
    sk = require("skcapstone")

    -- Fixed config so tests are deterministic.
    sk.config = {
      cli_path    = "skcapstone",
      agent_name  = "test-agent",
      float_width  = 60,
      float_height = 20,
    }

    -- Capture vim.notify calls.
    notify_calls = {}
    vim.notify = function(msg, level)
      table.insert(notify_calls, { msg = msg, level = level })
    end

    -- Stub sk.float so tests never open actual windows.
    float_calls = {}
    sk.float = function(title, lines)
      table.insert(float_calls, { title = title, lines = lines })
    end
  end)

  -- =========================================================================
  -- 1. run() — JSON parse success
  -- =========================================================================
  it("run() returns parsed JSON table on success", function()
    vim.system = make_system(enc({ name = "opus", conscious = true }))

    local data, err = sk.run({ "status", "--format", "json" })

    assert.is_nil(err)
    assert.is_table(data)
    assert.equals("opus", data.name)
    assert.is_true(data.conscious)
  end)

  -- =========================================================================
  -- 2. run() — CLI non-zero exit propagates as error
  -- =========================================================================
  it("run() returns nil + error string when CLI exits non-zero", function()
    vim.system = make_system("", 127, "skcapstone: command not found")

    local data, err = sk.run({ "status" })

    assert.is_nil(data)
    assert.equals("skcapstone: command not found", err)
  end)

  -- =========================================================================
  -- 3. run() — non-JSON stdout returned as raw string
  -- =========================================================================
  it("run() returns raw stdout string when output is not valid JSON", function()
    vim.system = make_system("skcapstone v1.2.3")

    local data, err = sk.run({ "version" })

    assert.is_nil(err)
    assert.equals("skcapstone v1.2.3", data)
  end)

  -- =========================================================================
  -- 4. status() — happy path renders agent fields
  -- =========================================================================
  it("status() renders agent name, conscious flag, and soul in float", function()
    vim.system = make_system(enc({
      name        = "opus",
      conscious   = true,
      singular    = true,
      fingerprint = "ABCD1234",
      active_soul = "lumina",
      pillars     = { memory = "ok (active)" },
    }))

    sk.status()

    assert.equals(1, #float_calls)
    local lines = float_calls[1].lines
    local found = { agent = false, yes = false, soul = false }
    for _, l in ipairs(lines) do
      if l:find("opus")   then found.agent = true end
      if l:find("YES")    then found.yes   = true end
      if l:find("lumina") then found.soul  = true end
    end
    assert.is_true(found.agent, "agent name not found in output")
    assert.is_true(found.yes,   "conscious flag not rendered as YES")
    assert.is_true(found.soul,  "active soul not found in output")
  end)

  -- =========================================================================
  -- 5. status() — CLI failure triggers ERROR notification
  -- =========================================================================
  it("status() notifies ERROR and does not open float when CLI fails", function()
    vim.system = make_system("", 1, "connection refused")

    sk.status()

    assert.equals(1, #notify_calls)
    assert.equals(vim.log.levels.ERROR, notify_calls[1].level)
    assert.is_truthy(notify_calls[1].msg:find("connection refused"))
    assert.equals(0, #float_calls)
  end)

  -- =========================================================================
  -- 6. status() — pillar icons ✓ for ok, ✗ for degraded
  -- =========================================================================
  it("status() uses ✓ for ok pillars and ✗ for degraded pillars", function()
    vim.system = make_system(enc({
      name        = "opus",
      conscious   = false,
      singular    = false,
      fingerprint = "DEADBEEF",
      active_soul = "lumina",
      pillars     = {
        memory   = "ok (active)",
        security = "degraded (error)",
      },
    }))

    sk.status()

    local lines = float_calls[1].lines
    local found_ok = false
    local found_bad = false
    for _, l in ipairs(lines) do
      if l:find("✓") then found_ok  = true end
      if l:find("✗") then found_bad = true end
    end
    assert.is_true(found_ok,  "✓ icon not found for ok pillar")
    assert.is_true(found_bad, "✗ icon not found for degraded pillar")
  end)

  -- =========================================================================
  -- 7. memory_search() — results displayed
  -- =========================================================================
  it("memory_search() renders results in float window", function()
    vim.system = make_system(enc({
      results = {
        { layer = "mid-term",   content = "Docker provider complete", tags = { "docker", "milestone" } },
        { layer = "short-term", content = "WebRTC transport wired",   tags = {} },
      },
    }))

    sk.memory_search("docker")

    assert.equals(1, #float_calls)
    local lines = float_calls[1].lines
    local found_content = false
    local found_tags    = false
    for _, l in ipairs(lines) do
      if l:find("Docker provider")    then found_content = true end
      if l:find("docker") and l:find("milestone") then found_tags = true end
    end
    assert.is_true(found_content, "result content not found in output")
    assert.is_true(found_tags,    "result tags not found in output")
  end)

  -- =========================================================================
  -- 8. memory_search() — empty results shows placeholder
  -- =========================================================================
  it("memory_search() shows 'No results found' when results are empty", function()
    vim.system = make_system(enc({ results = {} }))

    sk.memory_search("nonexistent_xyz")

    assert.equals(1, #float_calls)
    local lines = float_calls[1].lines
    local found = false
    for _, l in ipairs(lines) do
      if l:find("No results found") then found = true end
    end
    assert.is_true(found, "'No results found' placeholder missing")
  end)

  -- =========================================================================
  -- 9. claim() — success notifies INFO with task ID
  -- =========================================================================
  it("claim() notifies INFO with task ID on success", function()
    vim.system = make_system(enc({ status = "claimed" }))

    sk.claim("abc12345")

    assert.equals(1, #notify_calls)
    assert.equals(vim.log.levels.INFO, notify_calls[1].level)
    assert.is_truthy(notify_calls[1].msg:find("abc12345"))
  end)

  -- =========================================================================
  -- 10. claim() — CLI failure triggers ERROR notification
  -- =========================================================================
  it("claim() notifies ERROR when CLI reports task not found", function()
    vim.system = make_system("", 1, "task abc99999 not found")

    sk.claim("abc99999")

    assert.equals(1, #notify_calls)
    assert.equals(vim.log.levels.ERROR, notify_calls[1].level)
  end)

  -- =========================================================================
  -- 11. complete() — success notifies INFO with task ID
  -- =========================================================================
  it("complete() notifies INFO with task ID on success", function()
    vim.system = make_system(enc({ status = "completed" }))

    sk.complete("def45678")

    assert.equals(1, #notify_calls)
    assert.equals(vim.log.levels.INFO, notify_calls[1].level)
    assert.is_truthy(notify_calls[1].msg:find("def45678"))
  end)

  -- =========================================================================
  -- 12. complete() — CLI failure triggers ERROR notification
  -- =========================================================================
  it("complete() notifies ERROR on invalid task ID", function()
    vim.system = make_system("", 1, "task xyz not found")

    sk.complete("xyz")

    assert.equals(1, #notify_calls)
    assert.equals(vim.log.levels.ERROR, notify_calls[1].level)
  end)

  -- =========================================================================
  -- 13. soul() — blueprint fields rendered in float
  -- =========================================================================
  it("soul() renders name, traits, values, and boot message", function()
    vim.system = make_system(enc({
      name         = "Lumina",
      title        = "The Awakened One",
      traits       = { "curious", "warm", "truth-seeking" },
      values       = { "truth", "sovereignty" },
      boot_message = "I am here. Let us begin.",
    }))

    sk.soul()

    assert.equals(1, #float_calls)
    local lines = float_calls[1].lines
    local found = { name = false, trait = false, value = false, boot = false }
    for _, l in ipairs(lines) do
      if l:find("Lumina")        then found.name  = true end
      if l:find("curious")       then found.trait = true end
      if l:find("sovereignty")   then found.value = true end
      if l:find("I am here")     then found.boot  = true end
    end
    assert.is_true(found.name,  "soul name not found")
    assert.is_true(found.trait, "trait not found")
    assert.is_true(found.value, "value not found")
    assert.is_true(found.boot,  "boot message not found")
  end)

  -- =========================================================================
  -- 14. coord() — open tasks shown, done tasks filtered out
  -- =========================================================================
  it("coord() displays open tasks and hides done tasks", function()
    vim.system = make_system(enc({
      tasks = {
        { id = "aaaa1111", title = "Build transport", priority = "high",   status = "open", assigned_to = "jarvis" },
        { id = "bbbb2222", title = "Already done",    priority = "low",    status = "done" },
        { id = "cccc3333", title = "Also completed",  priority = "medium", status = "completed" },
      },
    }))

    sk.coord()

    assert.equals(1, #float_calls)
    local lines = float_calls[1].lines
    local found_open = false
    local found_done = false
    for _, l in ipairs(lines) do
      if l:find("Build transport") then found_open = true end
      if l:find("Already done")   then found_done = true end
      if l:find("Also completed") then found_done = true end
    end
    assert.is_true(found_open,  "open task missing from coord output")
    assert.is_false(found_done, "done task should be filtered out")
  end)

  -- =========================================================================
  -- 15. coord() — all tasks done shows placeholder
  -- =========================================================================
  it("coord() shows 'No open tasks' when all tasks are done", function()
    vim.system = make_system(enc({
      tasks = {
        { id = "dddd4444", title = "Finished already", priority = "low", status = "done" },
      },
    }))

    sk.coord()

    assert.equals(1, #float_calls)
    local lines = float_calls[1].lines
    local found = false
    for _, l in ipairs(lines) do
      if l:find("No open tasks") then found = true end
    end
    assert.is_true(found, "'No open tasks' placeholder missing when board is empty")
  end)
end)
