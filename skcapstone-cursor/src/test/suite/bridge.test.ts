/**
 * Unit tests for skcapstone-cursor bridge (src/bridge.ts).
 *
 * child_process.execFile and relevant fs functions are stubbed with sinon so
 * that no real Python/skcapstone binary is required.
 *
 * Runs inside the @vscode/test-electron host (headless via xvfb-run in CI).
 *
 * Stub mechanics:
 *   TypeScript compiles `import { execFile } from "child_process"` to
 *     const child_process_1 = require("child_process");
 *     (0, child_process_1.execFile)(...)
 *   so sinon.stub(require("child_process"), "execFile") intercepts calls
 *   from bridge.ts through the shared CommonJS module cache.
 */

import * as assert from "assert";
import * as sinon from "sinon";
import * as childProcess from "child_process";
import * as fs from "fs";
import * as fsp from "fs/promises";
import * as bridge from "../../bridge";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type ExecFileCallback = (
  error: NodeJS.ErrnoException | null,
  stdout: string,
  stderr: string
) => void;

function fakeExecSuccess(stdout: string) {
  return (
    _cmd: string,
    _args: string[],
    _opts: object,
    cb: ExecFileCallback
  ) => {
    cb(null, stdout, "");
  };
}

function fakeExecError(msg: string, exitCode = 1) {
  const err = Object.assign(new Error(msg), { code: exitCode });
  return (
    _cmd: string,
    _args: string[],
    _opts: object,
    cb: ExecFileCallback
  ) => {
    cb(err, "", msg);
  };
}

// ---------------------------------------------------------------------------
// Suite: runCli
// ---------------------------------------------------------------------------

suite("SKCapstone Cursor Bridge — runCli", () => {
  let execFileStub: sinon.SinonStub;

  setup(() => {
    execFileStub = sinon.stub(childProcess, "execFile");
  });

  teardown(() => {
    sinon.restore();
  });

  test("invokes python with '-m skcapstone.cli' and the provided args", async () => {
    execFileStub.callsFake(fakeExecSuccess(""));

    await bridge.runCli(["coord", "status"]);

    assert.ok(execFileStub.calledOnce, "execFile must be called once");
    const [, args] = execFileStub.firstCall.args as [string, string[]];
    // args starts with ["-m", "skcapstone.cli", ...]
    assert.strictEqual(args[0], "-m");
    assert.strictEqual(args[1], "skcapstone.cli");
    assert.ok(args.includes("coord"));
    assert.ok(args.includes("status"));
  });

  test("returns stdout, stderr, and exitCode 0 on success", async () => {
    execFileStub.callsFake(fakeExecSuccess("hello world"));

    const result = await bridge.runCli(["status"]);

    assert.strictEqual(result.stdout, "hello world");
    assert.strictEqual(result.exitCode, 0);
  });

  test("returns non-zero exitCode on error", async () => {
    execFileStub.callsFake(fakeExecError("not found", 127));

    const result = await bridge.runCli(["bad"]);

    assert.ok(result.exitCode !== 0, "exitCode must be non-zero on error");
  });

  test("returns stderr text on error", async () => {
    execFileStub.callsFake(
      (_cmd: string, _args: string[], _opts: object, cb: ExecFileCallback) => {
        const err = Object.assign(new Error("exit"), { code: 1 });
        cb(err, "", "error output from python");
      }
    );

    const result = await bridge.runCli(["status"]);

    assert.strictEqual(result.stderr, "error output from python");
  });

  test("uses 15-second default timeout option", async () => {
    execFileStub.callsFake(fakeExecSuccess(""));

    await bridge.runCli(["status"]);

    const opts = execFileStub.firstCall.args[2] as { timeout: number };
    assert.strictEqual(opts.timeout, 15_000);
  });

  test("respects custom timeout argument", async () => {
    execFileStub.callsFake(fakeExecSuccess(""));

    await bridge.runCli(["status"], 5_000);

    const opts = execFileStub.firstCall.args[2] as { timeout: number };
    assert.strictEqual(opts.timeout, 5_000);
  });
});

// ---------------------------------------------------------------------------
// Suite: isAgentInitialized
// ---------------------------------------------------------------------------

suite("SKCapstone Cursor Bridge — isAgentInitialized", () => {
  let existsSyncStub: sinon.SinonStub;

  setup(() => {
    existsSyncStub = sinon.stub(fs, "existsSync");
  });

  teardown(() => {
    sinon.restore();
  });

  test("returns false when the agent home directory does not exist", () => {
    existsSyncStub.returns(false);

    const result = bridge.isAgentInitialized();

    assert.strictEqual(result, false);
  });

  test("returns false when the manifest.json is missing", () => {
    // First call (home dir check) returns true; second (manifest.json) false
    existsSyncStub.onFirstCall().returns(true);
    existsSyncStub.onSecondCall().returns(false);

    const result = bridge.isAgentInitialized();

    assert.strictEqual(result, false);
  });

  test("returns true when both home and manifest.json exist", () => {
    existsSyncStub.returns(true);

    const result = bridge.isAgentInitialized();

    assert.strictEqual(result, true);
  });
});

// ---------------------------------------------------------------------------
// Suite: getCoordBoard
// ---------------------------------------------------------------------------

suite("SKCapstone Cursor Bridge — getCoordBoard", () => {
  let execFileStub: sinon.SinonStub;

  setup(() => {
    execFileStub = sinon.stub(childProcess, "execFile");
  });

  teardown(() => {
    sinon.restore();
  });

  test("passes 'coord briefing --format json' args to python CLI", async () => {
    execFileStub.callsFake(fakeExecSuccess("{}"));

    await bridge.getCoordBoard();

    const [, args] = execFileStub.firstCall.args as [string, string[]];
    assert.ok(args.includes("coord"));
    assert.ok(args.includes("briefing"));
    assert.ok(args.includes("--format"));
    assert.ok(args.includes("json"));
  });

  test("parses tasks and agents from JSON response", async () => {
    const mockData = {
      tasks: [
        {
          id: "t1",
          title: "Fix bug",
          priority: "high",
          status: "open",
          claimed_by: "opus",
          tags: ["fix"],
        },
      ],
      agents: [
        { name: "opus", state: "active", current_task: "t1" },
      ],
    };
    execFileStub.callsFake(fakeExecSuccess(JSON.stringify(mockData)));

    const board = await bridge.getCoordBoard();

    assert.strictEqual(board.tasks.length, 1);
    assert.strictEqual(board.tasks[0].id, "t1");
    assert.strictEqual(board.tasks[0].title, "Fix bug");
    assert.strictEqual(board.tasks[0].claimedBy, "opus");
    assert.deepStrictEqual(board.tasks[0].tags, ["fix"]);

    assert.strictEqual(board.agents.length, 1);
    assert.strictEqual(board.agents[0].name, "opus");
    assert.strictEqual(board.agents[0].state, "active");
    assert.strictEqual(board.agents[0].currentTask, "t1");
  });

  test("computes board summary counts correctly", async () => {
    const mockData = {
      tasks: [
        { id: "t1", title: "Open 1", priority: "high", status: "open", tags: [] },
        { id: "t2", title: "Open 2", priority: "low", status: "open", tags: [] },
        { id: "t3", title: "In progress", priority: "medium", status: "in_progress", tags: [] },
        { id: "t4", title: "Done", priority: "low", status: "done", tags: [] },
      ],
      agents: [],
    };
    execFileStub.callsFake(fakeExecSuccess(JSON.stringify(mockData)));

    const board = await bridge.getCoordBoard();

    assert.strictEqual(board.summary.total, 4);
    assert.strictEqual(board.summary.open, 2);
    assert.strictEqual(board.summary.inProgress, 1);
    assert.strictEqual(board.summary.done, 1);
  });

  test("returns empty board when CLI exits with non-zero code", async () => {
    execFileStub.callsFake(fakeExecError("CLI error"));

    const board = await bridge.getCoordBoard();

    assert.deepStrictEqual(board.tasks, []);
    assert.deepStrictEqual(board.agents, []);
    assert.strictEqual(board.summary.total, 0);
  });

  test("returns empty board when CLI output is not valid JSON", async () => {
    execFileStub.callsFake(fakeExecSuccess("not json at all"));

    const board = await bridge.getCoordBoard();

    assert.deepStrictEqual(board.tasks, []);
  });

  test("uses null for claimed_by when field is absent", async () => {
    const mockData = {
      tasks: [{ id: "t1", title: "Task", priority: "medium", status: "open", tags: [] }],
      agents: [],
    };
    execFileStub.callsFake(fakeExecSuccess(JSON.stringify(mockData)));

    const board = await bridge.getCoordBoard();

    assert.strictEqual(board.tasks[0].claimedBy, null);
  });
});

// ---------------------------------------------------------------------------
// Suite: claimTask
// ---------------------------------------------------------------------------

suite("SKCapstone Cursor Bridge — claimTask", () => {
  let execFileStub: sinon.SinonStub;

  setup(() => {
    execFileStub = sinon.stub(childProcess, "execFile");
  });

  teardown(() => {
    sinon.restore();
  });

  test("passes 'coord claim <taskId> --agent <agentName>'", async () => {
    execFileStub.callsFake(fakeExecSuccess(""));

    await bridge.claimTask("task-xyz", "lumina");

    const [, args] = execFileStub.firstCall.args as [string, string[]];
    assert.ok(args.includes("coord"));
    assert.ok(args.includes("claim"));
    assert.ok(args.includes("task-xyz"));
    assert.ok(args.includes("--agent"));
    assert.ok(args.includes("lumina"));
  });

  test("returns true on success (exit code 0)", async () => {
    execFileStub.callsFake(fakeExecSuccess(""));

    const result = await bridge.claimTask("task-abc", "opus");

    assert.strictEqual(result, true);
  });

  test("returns false on CLI error", async () => {
    execFileStub.callsFake(fakeExecError("claim failed"));

    const result = await bridge.claimTask("task-abc", "opus");

    assert.strictEqual(result, false);
  });
});

// ---------------------------------------------------------------------------
// Suite: storeMemory
// ---------------------------------------------------------------------------

suite("SKCapstone Cursor Bridge — storeMemory", () => {
  let execFileStub: sinon.SinonStub;

  setup(() => {
    execFileStub = sinon.stub(childProcess, "execFile");
  });

  teardown(() => {
    sinon.restore();
  });

  test("passes 'memory store <content>' with tags and importance", async () => {
    execFileStub.callsFake(fakeExecSuccess(""));

    await bridge.storeMemory("Test discovery", ["arch", "code"], 0.8);

    const [, args] = execFileStub.firstCall.args as [string, string[]];
    assert.ok(args.includes("memory"));
    assert.ok(args.includes("store"));
    assert.ok(args.includes("Test discovery"));
    assert.ok(args.includes("-t"), "Must pass each tag with -t flag");
    assert.ok(args.includes("arch"));
    assert.ok(args.includes("code"));
    assert.ok(args.includes("-i"));
    assert.ok(args.includes("0.8"));
  });

  test("returns true on success", async () => {
    execFileStub.callsFake(fakeExecSuccess(""));

    const result = await bridge.storeMemory("Content", [], 0.5);

    assert.strictEqual(result, true);
  });

  test("returns false on CLI error", async () => {
    execFileStub.callsFake(fakeExecError("store failed"));

    const result = await bridge.storeMemory("Content", [], 0.5);

    assert.strictEqual(result, false);
  });

  test("passes no -t args when tags array is empty", async () => {
    execFileStub.callsFake(fakeExecSuccess(""));

    await bridge.storeMemory("Content", [], 0.5);

    const [, args] = execFileStub.firstCall.args as [string, string[]];
    assert.ok(!args.includes("-t"), "-t must be absent when no tags");
  });
});

// ---------------------------------------------------------------------------
// Suite: searchMemory
// ---------------------------------------------------------------------------

suite("SKCapstone Cursor Bridge — searchMemory", () => {
  let execFileStub: sinon.SinonStub;

  setup(() => {
    execFileStub = sinon.stub(childProcess, "execFile");
  });

  teardown(() => {
    sinon.restore();
  });

  test("passes 'memory search <query> -n <limit>' args", async () => {
    execFileStub.callsFake(fakeExecSuccess("search output"));

    await bridge.searchMemory("capauth");

    const [, args] = execFileStub.firstCall.args as [string, string[]];
    assert.ok(args.includes("memory"));
    assert.ok(args.includes("search"));
    assert.ok(args.includes("capauth"));
    assert.ok(args.includes("-n"));
  });

  test("returns stdout output on success", async () => {
    execFileStub.callsFake(fakeExecSuccess("Memory result text"));

    const output = await bridge.searchMemory("test");

    assert.strictEqual(output, "Memory result text");
  });

  test("returns stderr when stdout is empty", async () => {
    execFileStub.callsFake(
      (_cmd: string, _args: string[], _opts: object, cb: ExecFileCallback) => {
        const err = Object.assign(new Error("exit"), { code: 1 });
        cb(err, "", "stderr error message");
      }
    );

    const output = await bridge.searchMemory("test");

    assert.strictEqual(output, "stderr error message");
  });

  test("uses default limit of 10", async () => {
    execFileStub.callsFake(fakeExecSuccess(""));

    await bridge.searchMemory("query");

    const [, args] = execFileStub.firstCall.args as [string, string[]];
    const nIdx = args.indexOf("-n");
    assert.ok(nIdx >= 0, "-n flag must be present");
    assert.strictEqual(args[nIdx + 1], "10", "Default limit must be 10");
  });
});

// ---------------------------------------------------------------------------
// Suite: syncPush
// ---------------------------------------------------------------------------

suite("SKCapstone Cursor Bridge — syncPush", () => {
  let execFileStub: sinon.SinonStub;

  setup(() => {
    execFileStub = sinon.stub(childProcess, "execFile");
  });

  teardown(() => {
    sinon.restore();
  });

  test("passes 'sync push' args to the CLI", async () => {
    execFileStub.callsFake(fakeExecSuccess(""));

    await bridge.syncPush();

    const [, args] = execFileStub.firstCall.args as [string, string[]];
    assert.ok(args.includes("sync"));
    assert.ok(args.includes("push"));
  });

  test("returns true on success", async () => {
    execFileStub.callsFake(fakeExecSuccess(""));

    const result = await bridge.syncPush();

    assert.strictEqual(result, true);
  });

  test("returns false on CLI error", async () => {
    execFileStub.callsFake(fakeExecError("GPG key missing"));

    const result = await bridge.syncPush();

    assert.strictEqual(result, false);
  });
});

// ---------------------------------------------------------------------------
// Suite: getAgentHome
// ---------------------------------------------------------------------------

suite("SKCapstone Cursor Bridge — getAgentHome", () => {
  const originalEnv = process.env.SKCAPSTONE_HOME;

  teardown(() => {
    // Restore env after each test
    if (originalEnv === undefined) {
      delete process.env.SKCAPSTONE_HOME;
    } else {
      process.env.SKCAPSTONE_HOME = originalEnv;
    }
  });

  test("returns SKCAPSTONE_HOME env var when set", () => {
    process.env.SKCAPSTONE_HOME = "/tmp/test-agent-home";

    const home = bridge.getAgentHome();

    assert.strictEqual(home, "/tmp/test-agent-home");
  });

  test("falls back to ~/.skcapstone when SKCAPSTONE_HOME is unset", () => {
    delete process.env.SKCAPSTONE_HOME;

    const home = bridge.getAgentHome();

    assert.ok(
      home.includes(".skcapstone"),
      `Default home must contain .skcapstone, got: ${home}`
    );
  });
});
