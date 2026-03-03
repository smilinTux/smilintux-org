/**
 * Unit tests for skcapstone-cursor bridge (src/bridge.ts).
 *
 * Runs with vitest — no VSCode or Electron required.
 * child_process, fs, and fs/promises are mocked via vi.mock().
 *
 * Run:  npx vitest run   (or npm test)
 */

import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";

// Module mocks must be declared before any imports that pull in bridge.ts.
vi.mock("child_process", () => ({ execFile: vi.fn() }));
vi.mock("fs", () => ({ existsSync: vi.fn() }));
vi.mock("fs/promises", () => ({ readFile: vi.fn() }));

import { execFile } from "child_process";
import { existsSync } from "fs";
import { readFile } from "fs/promises";
import * as bridge from "../../bridge";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type ExecCb = (
  error: NodeJS.ErrnoException | null,
  stdout: string,
  stderr: string
) => void;

/** Make execFile call the callback with a successful response. */
function stubSuccess(stdout: string) {
  vi.mocked(execFile).mockImplementation(
    (_file: string, _args: any, _opts: any, cb: any) => {
      (cb as ExecCb)(null, stdout, "");
      return {} as any;
    }
  );
}

/** Make execFile call the callback with an error response. */
function stubError(msg: string, code = 1) {
  const err = Object.assign(new Error(msg), { code });
  vi.mocked(execFile).mockImplementation(
    (_file: string, _args: any, _opts: any, cb: any) => {
      (cb as ExecCb)(err as NodeJS.ErrnoException, "", msg);
      return {} as any;
    }
  );
}

// ---------------------------------------------------------------------------
// Suite: runCli
// ---------------------------------------------------------------------------

describe("bridge.runCli", () => {
  it("invokes python with -m skcapstone.cli and the supplied args", async () => {
    stubSuccess("");

    await bridge.runCli(["coord", "status"]);

    expect(execFile).toHaveBeenCalledOnce();
    const [, args] = vi.mocked(execFile).mock.calls[0] as [string, string[]];
    expect(args[0]).toBe("-m");
    expect(args[1]).toBe("skcapstone.cli");
    expect(args).toContain("coord");
    expect(args).toContain("status");
  });

  it("returns stdout and exitCode 0 on success", async () => {
    stubSuccess("agent status output");

    const result = await bridge.runCli(["status"]);

    expect(result.stdout).toBe("agent status output");
    expect(result.exitCode).toBe(0);
  });

  it("returns non-zero exitCode and stderr on CLI error", async () => {
    stubError("skcapstone: command not found", 127);

    const result = await bridge.runCli(["status"]);

    expect(result.exitCode).toBe(127);
    expect(result.stderr).toBe("skcapstone: command not found");
  });

  it("uses a 15-second default timeout", async () => {
    stubSuccess("");

    await bridge.runCli(["status"]);

    const opts = vi.mocked(execFile).mock.calls[0][2] as { timeout: number };
    expect(opts.timeout).toBe(15_000);
  });

  it("respects a custom timeout argument", async () => {
    stubSuccess("");

    await bridge.runCli(["status"], 3_000);

    const opts = vi.mocked(execFile).mock.calls[0][2] as { timeout: number };
    expect(opts.timeout).toBe(3_000);
  });
});

// ---------------------------------------------------------------------------
// Suite: isAgentInitialized
// ---------------------------------------------------------------------------

describe("bridge.isAgentInitialized", () => {
  it("returns false when the agent home directory does not exist", () => {
    vi.mocked(existsSync).mockReturnValue(false);

    expect(bridge.isAgentInitialized()).toBe(false);
  });

  it("returns false when manifest.json is absent", () => {
    vi.mocked(existsSync)
      .mockReturnValueOnce(true)   // home dir exists
      .mockReturnValueOnce(false); // manifest.json missing

    expect(bridge.isAgentInitialized()).toBe(false);
  });

  it("returns true when home and manifest.json both exist", () => {
    vi.mocked(existsSync).mockReturnValue(true);

    expect(bridge.isAgentInitialized()).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Suite: getCoordBoard
// ---------------------------------------------------------------------------

describe("bridge.getCoordBoard", () => {
  it("passes coord briefing --format json to the CLI", async () => {
    stubSuccess("{}");

    await bridge.getCoordBoard();

    const [, args] = vi.mocked(execFile).mock.calls[0] as [string, string[]];
    expect(args).toContain("coord");
    expect(args).toContain("briefing");
    expect(args).toContain("--format");
    expect(args).toContain("json");
  });

  it("parses tasks and agents from valid JSON response", async () => {
    const payload = {
      tasks: [
        {
          id: "ab12cd34",
          title: "Deploy service",
          priority: "high",
          status: "open",
          claimed_by: "lumina",
          tags: ["infra"],
        },
      ],
      agents: [{ name: "lumina", state: "active", current_task: "ab12cd34" }],
    };
    stubSuccess(JSON.stringify(payload));

    const board = await bridge.getCoordBoard();

    expect(board.tasks).toHaveLength(1);
    expect(board.tasks[0].id).toBe("ab12cd34");
    expect(board.tasks[0].title).toBe("Deploy service");
    expect(board.tasks[0].claimedBy).toBe("lumina");
    expect(board.tasks[0].tags).toEqual(["infra"]);
    expect(board.agents[0].name).toBe("lumina");
    expect(board.agents[0].currentTask).toBe("ab12cd34");
  });

  it("computes board summary counts correctly", async () => {
    const payload = {
      tasks: [
        { id: "t1", title: "A", priority: "high", status: "open", tags: [] },
        { id: "t2", title: "B", priority: "high", status: "open", tags: [] },
        { id: "t3", title: "C", priority: "low", status: "in_progress", tags: [] },
        { id: "t4", title: "D", priority: "low", status: "done", tags: [] },
        { id: "t5", title: "E", priority: "medium", status: "claimed", tags: [] },
      ],
      agents: [],
    };
    stubSuccess(JSON.stringify(payload));

    const board = await bridge.getCoordBoard();

    expect(board.summary.total).toBe(5);
    expect(board.summary.open).toBe(2);
    expect(board.summary.inProgress).toBe(1);
    expect(board.summary.done).toBe(1);
    expect(board.summary.claimed).toBe(1);
  });

  it("returns an empty board when the CLI exits non-zero", async () => {
    stubError("daemon not running");

    const board = await bridge.getCoordBoard();

    expect(board.tasks).toEqual([]);
    expect(board.agents).toEqual([]);
    expect(board.summary.total).toBe(0);
  });

  it("returns an empty board when CLI output is invalid JSON", async () => {
    stubSuccess("not json");

    const board = await bridge.getCoordBoard();

    expect(board.tasks).toEqual([]);
  });

  it("sets claimedBy to null when claimed_by field is absent", async () => {
    const payload = {
      tasks: [{ id: "t1", title: "Open", priority: "medium", status: "open", tags: [] }],
      agents: [],
    };
    stubSuccess(JSON.stringify(payload));

    const board = await bridge.getCoordBoard();

    expect(board.tasks[0].claimedBy).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Suite: claimTask
// ---------------------------------------------------------------------------

describe("bridge.claimTask", () => {
  it("passes coord claim <id> --agent <name> to the CLI", async () => {
    stubSuccess("");

    await bridge.claimTask("task-99", "opus");

    const [, args] = vi.mocked(execFile).mock.calls[0] as [string, string[]];
    expect(args).toContain("coord");
    expect(args).toContain("claim");
    expect(args).toContain("task-99");
    expect(args).toContain("--agent");
    expect(args).toContain("opus");
  });

  it("returns true on success", async () => {
    stubSuccess("");
    expect(await bridge.claimTask("t1", "lumina")).toBe(true);
  });

  it("returns false on CLI error", async () => {
    stubError("task not found");
    expect(await bridge.claimTask("bad-id", "lumina")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Suite: storeMemory
// ---------------------------------------------------------------------------

describe("bridge.storeMemory", () => {
  it("passes memory store with content, tags, and importance", async () => {
    stubSuccess("");

    await bridge.storeMemory("Test finding", ["arch", "sprint"], 0.9);

    const [, args] = vi.mocked(execFile).mock.calls[0] as [string, string[]];
    expect(args).toContain("memory");
    expect(args).toContain("store");
    expect(args).toContain("Test finding");
    expect(args).toContain("-t");
    expect(args).toContain("arch");
    expect(args).toContain("sprint");
    expect(args).toContain("-i");
    expect(args).toContain("0.9");
  });

  it("omits -t flags when the tags array is empty", async () => {
    stubSuccess("");

    await bridge.storeMemory("Content only", [], 0.5);

    const [, args] = vi.mocked(execFile).mock.calls[0] as [string, string[]];
    expect(args).not.toContain("-t");
  });

  it("returns true on success and false on error", async () => {
    stubSuccess("");
    expect(await bridge.storeMemory("ok", [], 0.5)).toBe(true);

    stubError("memory write failed");
    expect(await bridge.storeMemory("fail", [], 0.5)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Suite: searchMemory
// ---------------------------------------------------------------------------

describe("bridge.searchMemory", () => {
  it("passes memory search <query> -n <limit> to the CLI", async () => {
    stubSuccess("results");

    await bridge.searchMemory("consciousness loop");

    const [, args] = vi.mocked(execFile).mock.calls[0] as [string, string[]];
    expect(args).toContain("memory");
    expect(args).toContain("search");
    expect(args).toContain("consciousness loop");
    expect(args).toContain("-n");
  });

  it("uses a default limit of 10", async () => {
    stubSuccess("");

    await bridge.searchMemory("query");

    const [, args] = vi.mocked(execFile).mock.calls[0] as [string, string[]];
    const idx = args.indexOf("-n");
    expect(idx).toBeGreaterThanOrEqual(0);
    expect(args[idx + 1]).toBe("10");
  });

  it("returns stdout on success", async () => {
    stubSuccess("Memory: Sprint 9 consciousness loop");

    const out = await bridge.searchMemory("sprint");

    expect(out).toBe("Memory: Sprint 9 consciousness loop");
  });

  it("returns stderr when stdout is empty", async () => {
    stubError("no results", 1);

    const out = await bridge.searchMemory("missing");

    expect(out).toBe("no results");
  });
});

// ---------------------------------------------------------------------------
// Suite: syncPush
// ---------------------------------------------------------------------------

describe("bridge.syncPush", () => {
  it("passes sync push to the CLI", async () => {
    stubSuccess("");

    await bridge.syncPush();

    const [, args] = vi.mocked(execFile).mock.calls[0] as [string, string[]];
    expect(args).toContain("sync");
    expect(args).toContain("push");
  });

  it("returns true on success and false on error", async () => {
    stubSuccess("");
    expect(await bridge.syncPush()).toBe(true);

    stubError("GPG key missing");
    expect(await bridge.syncPush()).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Suite: getAgentHome
// ---------------------------------------------------------------------------

describe("bridge.getAgentHome", () => {
  const saved = process.env.SKCAPSTONE_HOME;

  beforeEach(() => {
    delete process.env.SKCAPSTONE_HOME;
  });

  // Restore after all tests in this suite finish.
  afterAll(() => {
    if (saved !== undefined) {
      process.env.SKCAPSTONE_HOME = saved;
    } else {
      delete process.env.SKCAPSTONE_HOME;
    }
  });

  it("returns SKCAPSTONE_HOME when set", () => {
    process.env.SKCAPSTONE_HOME = "/tmp/test-home";

    expect(bridge.getAgentHome()).toBe("/tmp/test-home");
  });

  it("falls back to ~/.skcapstone when SKCAPSTONE_HOME is unset", () => {
    const home = bridge.getAgentHome();

    expect(home).toMatch(/\.skcapstone$/);
  });
});
