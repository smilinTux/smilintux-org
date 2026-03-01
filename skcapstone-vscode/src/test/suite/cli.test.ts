/**
 * Unit tests for skcapstone-vscode CLI bridge (src/cli.ts).
 *
 * child_process.execFile is stubbed with sinon so that no real skcapstone
 * binary is needed.  Tests verify argument construction, JSON parsing,
 * default values, and error propagation for every exported function.
 *
 * Runs inside the @vscode/test-electron host (headless via xvfb-run in CI).
 *
 * Note on stub mechanics: TypeScript compiles named imports to
 *   const child_process_1 = require("child_process");
 *   child_process_1.execFile(...)
 * so sinon.stub(require("child_process"), "execFile") affects the same
 * cached module object and intercepts all calls from cli.ts.
 */

import * as assert from "assert";
import * as sinon from "sinon";
import * as childProcess from "child_process";
import * as cli from "../../cli";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type ExecFileCallback = (
  error: NodeJS.ErrnoException | null,
  stdout: string,
  stderr: string
) => void;

/** Fake a successful execFile call returning JSON-serialised data. */
function fakeSuccess(data: unknown) {
  return (
    _cmd: string,
    _args: string[],
    _opts: object,
    cb: ExecFileCallback
  ) => {
    cb(null, JSON.stringify(data), "");
  };
}

/** Fake a failed execFile call. */
function fakeError(msg: string, code = 1) {
  const err = Object.assign(new Error(msg), { code });
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
// Suite: runCommand
// ---------------------------------------------------------------------------

suite("SKCapstone VSCode CLI — runCommand", () => {
  let execFileStub: sinon.SinonStub;

  setup(() => {
    execFileStub = sinon.stub(childProcess, "execFile");
  });

  teardown(() => {
    sinon.restore();
  });

  test("invokes the skcapstone CLI binary with provided args", async () => {
    execFileStub.callsFake(fakeSuccess({ ok: true }));

    await cli.runCommand(["status", "--format", "json"]);

    assert.ok(execFileStub.calledOnce, "execFile must be called exactly once");
    const [cmd, args] = execFileStub.firstCall.args as [string, string[]];
    assert.strictEqual(cmd, "skcapstone");
    assert.deepStrictEqual(args, ["status", "--format", "json"]);
  });

  test("parses and returns JSON from stdout", async () => {
    execFileStub.callsFake(fakeSuccess({ name: "Opus", conscious: true }));

    const result = await cli.runCommand(["status"]);

    assert.deepStrictEqual(result, { name: "Opus", conscious: true });
  });

  test("returns trimmed raw text when stdout is not valid JSON", async () => {
    execFileStub.callsFake(
      (_cmd: string, _args: string[], _opts: object, cb: ExecFileCallback) => {
        cb(null, "  plain text output  ", "");
      }
    );

    const result = await cli.runCommand(["some", "cmd"]);
    assert.strictEqual(result, "plain text output");
  });

  test("rejects with descriptive error message on non-zero exit", async () => {
    execFileStub.callsFake(fakeError("command not found"));

    await assert.rejects(
      cli.runCommand(["bad", "args"]),
      /skcapstone bad args failed/,
      "rejection message must identify the failed subcommand"
    );
  });

  test("includes stderr text in the rejection message", async () => {
    execFileStub.callsFake(fakeError("No such file or directory"));

    await assert.rejects(
      cli.runCommand(["status"]),
      /No such file or directory/
    );
  });

  test("uses 15-second timeout option", async () => {
    execFileStub.callsFake(fakeSuccess({}));

    await cli.runCommand(["status"]);

    const opts = execFileStub.firstCall.args[2] as { timeout: number };
    assert.strictEqual(opts.timeout, 15000);
  });
});

// ---------------------------------------------------------------------------
// Suite: getStatus
// ---------------------------------------------------------------------------

suite("SKCapstone VSCode CLI — getStatus", () => {
  let execFileStub: sinon.SinonStub;

  setup(() => {
    execFileStub = sinon.stub(childProcess, "execFile");
  });

  teardown(() => {
    sinon.restore();
  });

  test("passes 'status --format json' to the CLI", async () => {
    execFileStub.callsFake(fakeSuccess({ name: "Opus" }));

    await cli.getStatus();

    const [, args] = execFileStub.firstCall.args as [string, string[]];
    assert.ok(args.includes("status"));
    assert.ok(args.includes("--format"));
    assert.ok(args.includes("json"));
  });

  test("maps all AgentStatus fields from CLI JSON", async () => {
    execFileStub.callsFake(
      fakeSuccess({
        name: "Opus",
        conscious: true,
        singular: true,
        fingerprint: "CCBE9306",
        pillars: { identity: "ok (active)", security: "ok (active)" },
        active_soul: "lumina",
      })
    );

    const s = await cli.getStatus();

    assert.strictEqual(s.name, "Opus");
    assert.strictEqual(s.conscious, true);
    assert.strictEqual(s.singular, true);
    assert.strictEqual(s.fingerprint, "CCBE9306");
    assert.deepStrictEqual(s.pillars, {
      identity: "ok (active)",
      security: "ok (active)",
    });
    assert.strictEqual(s.active_soul, "lumina");
  });

  test("returns safe defaults for an empty JSON response", async () => {
    execFileStub.callsFake(fakeSuccess({}));

    const s = await cli.getStatus();

    assert.strictEqual(s.name, "unknown");
    assert.strictEqual(s.conscious, false);
    assert.strictEqual(s.singular, false);
    assert.strictEqual(s.fingerprint, "");
    assert.deepStrictEqual(s.pillars, {});
    assert.strictEqual(s.active_soul, "");
  });
});

// ---------------------------------------------------------------------------
// Suite: getCoordTasks
// ---------------------------------------------------------------------------

suite("SKCapstone VSCode CLI — getCoordTasks", () => {
  let execFileStub: sinon.SinonStub;

  setup(() => {
    execFileStub = sinon.stub(childProcess, "execFile");
  });

  teardown(() => {
    sinon.restore();
  });

  test("passes 'coord status --format json' to the CLI", async () => {
    execFileStub.callsFake(fakeSuccess([]));

    await cli.getCoordTasks();

    const [, args] = execFileStub.firstCall.args as [string, string[]];
    assert.ok(args.includes("coord"));
    assert.ok(args.includes("status"));
  });

  test("maps task array from a { tasks: [...] } response", async () => {
    execFileStub.callsFake(
      fakeSuccess({
        tasks: [
          {
            id: "abc",
            title: "My Task",
            priority: "high",
            status: "open",
            assigned_to: "opus",
            tags: ["feat", "code"],
          },
        ],
      })
    );

    const tasks = await cli.getCoordTasks();

    assert.strictEqual(tasks.length, 1);
    assert.strictEqual(tasks[0].id, "abc");
    assert.strictEqual(tasks[0].title, "My Task");
    assert.strictEqual(tasks[0].priority, "high");
    assert.strictEqual(tasks[0].status, "open");
    assert.strictEqual(tasks[0].assigned_to, "opus");
    assert.deepStrictEqual(tasks[0].tags, ["feat", "code"]);
  });

  test("maps task array from a flat array response", async () => {
    execFileStub.callsFake(
      fakeSuccess([
        { id: "xyz", title: "Flat Task", priority: "low", status: "open" },
      ])
    );

    const tasks = await cli.getCoordTasks();

    assert.strictEqual(tasks.length, 1);
    assert.strictEqual(tasks[0].id, "xyz");
  });

  test("fills in missing fields with safe defaults", async () => {
    execFileStub.callsFake(fakeSuccess({ tasks: [{ id: "t1" }] }));

    const tasks = await cli.getCoordTasks();

    assert.strictEqual(tasks[0].title, "");
    assert.strictEqual(tasks[0].priority, "medium");
    assert.strictEqual(tasks[0].status, "open");
    assert.strictEqual(tasks[0].assigned_to, "");
    assert.deepStrictEqual(tasks[0].tags, []);
  });

  test("returns empty array when CLI errors", async () => {
    execFileStub.callsFake(fakeError("CLI not found"));

    const tasks = await cli.getCoordTasks();

    assert.deepStrictEqual(tasks, []);
  });
});

// ---------------------------------------------------------------------------
// Suite: searchMemories
// ---------------------------------------------------------------------------

suite("SKCapstone VSCode CLI — searchMemories", () => {
  let execFileStub: sinon.SinonStub;

  setup(() => {
    execFileStub = sinon.stub(childProcess, "execFile");
  });

  teardown(() => {
    sinon.restore();
  });

  test("includes the query string, 'memory search', and --json-out in args", async () => {
    execFileStub.callsFake(fakeSuccess({ results: [] }));

    await cli.searchMemories("capauth");

    const [, args] = execFileStub.firstCall.args as [string, string[]];
    assert.ok(args.includes("memory"));
    assert.ok(args.includes("search"));
    assert.ok(args.includes("capauth"));
    assert.ok(args.includes("--json-out"));
  });

  test("maps Memory objects from a results array", async () => {
    execFileStub.callsFake(
      fakeSuccess({
        results: [
          {
            id: "m1",
            content: "WebRTC transport added",
            layer: "mid-term",
            importance: 0.8,
            tags: ["webrtc"],
            created_at: "2026-01-01",
          },
        ],
      })
    );

    const mems = await cli.searchMemories("webrtc");

    assert.strictEqual(mems.length, 1);
    assert.strictEqual(mems[0].id, "m1");
    assert.strictEqual(mems[0].content, "WebRTC transport added");
    assert.strictEqual(mems[0].layer, "mid-term");
    assert.strictEqual(mems[0].importance, 0.8);
    assert.deepStrictEqual(mems[0].tags, ["webrtc"]);
    assert.strictEqual(mems[0].created_at, "2026-01-01");
  });

  test("maps Memory objects from a flat array response", async () => {
    execFileStub.callsFake(
      fakeSuccess([{ id: "m2", content: "CapAuth PGP", layer: "short-term" }])
    );

    const mems = await cli.searchMemories("capauth");

    assert.strictEqual(mems.length, 1);
    assert.strictEqual(mems[0].id, "m2");
  });

  test("fills in safe defaults for missing memory fields", async () => {
    execFileStub.callsFake(fakeSuccess({ results: [{ id: "mx" }] }));

    const mems = await cli.searchMemories("anything");

    assert.strictEqual(mems[0].content, "");
    assert.strictEqual(mems[0].layer, "short-term");
    assert.strictEqual(mems[0].importance, 0);
    assert.deepStrictEqual(mems[0].tags, []);
    assert.strictEqual(mems[0].created_at, "");
  });

  test("returns empty array when CLI errors", async () => {
    execFileStub.callsFake(fakeError("fail"));

    const mems = await cli.searchMemories("anything");

    assert.deepStrictEqual(mems, []);
  });
});

// ---------------------------------------------------------------------------
// Suite: storeMemory
// ---------------------------------------------------------------------------

suite("SKCapstone VSCode CLI — storeMemory", () => {
  let execFileStub: sinon.SinonStub;

  setup(() => {
    execFileStub = sinon.stub(childProcess, "execFile");
  });

  teardown(() => {
    sinon.restore();
  });

  test("passes 'memory store' with content, --importance, and --tags", async () => {
    execFileStub.callsFake(fakeSuccess({}));

    await cli.storeMemory("Important discovery", 0.9, ["arch", "webrtc"]);

    const [, args] = execFileStub.firstCall.args as [string, string[]];
    assert.ok(args.includes("memory"));
    assert.ok(args.includes("store"));
    assert.ok(args.includes("Important discovery"));
    assert.ok(args.includes("--importance"));
    assert.ok(args.includes("0.9"));
    assert.ok(args.includes("--tags"));
    assert.ok(args.includes("arch,webrtc"), "Tags must be joined with a comma");
  });

  test("omits --tags flag when tags array is empty", async () => {
    execFileStub.callsFake(fakeSuccess({}));

    await cli.storeMemory("Content", 0.5, []);

    const [, args] = execFileStub.firstCall.args as [string, string[]];
    assert.ok(!args.includes("--tags"), "--tags must be absent for empty tag list");
  });

  test("defaults importance to 0.5", async () => {
    execFileStub.callsFake(fakeSuccess({}));

    await cli.storeMemory("Content");

    const [, args] = execFileStub.firstCall.args as [string, string[]];
    assert.ok(args.includes("0.5"), "Default importance must be 0.5");
  });
});

// ---------------------------------------------------------------------------
// Suite: claimTask / completeTask
// ---------------------------------------------------------------------------

suite("SKCapstone VSCode CLI — claimTask & completeTask", () => {
  let execFileStub: sinon.SinonStub;

  setup(() => {
    execFileStub = sinon.stub(childProcess, "execFile");
  });

  teardown(() => {
    sinon.restore();
  });

  test("claimTask passes 'coord claim <taskId> --agent <name>'", async () => {
    execFileStub.callsFake(fakeSuccess({ ok: true }));

    await cli.claimTask("task-abc123");

    const [, args] = execFileStub.firstCall.args as [string, string[]];
    assert.ok(args.includes("coord"));
    assert.ok(args.includes("claim"));
    assert.ok(args.includes("task-abc123"));
    assert.ok(args.includes("--agent"));
    // Agent name comes from config; defaults to "vscode-agent" when not set
    const agentIdx = args.indexOf("--agent");
    assert.ok(agentIdx >= 0 && args[agentIdx + 1], "Agent name must follow --agent");
  });

  test("completeTask passes 'coord complete <taskId> --agent <name>'", async () => {
    execFileStub.callsFake(fakeSuccess({ ok: true }));

    await cli.completeTask("task-def456");

    const [, args] = execFileStub.firstCall.args as [string, string[]];
    assert.ok(args.includes("coord"));
    assert.ok(args.includes("complete"));
    assert.ok(args.includes("task-def456"));
    assert.ok(args.includes("--agent"));
  });
});

// ---------------------------------------------------------------------------
// Suite: getSoulBlueprint
// ---------------------------------------------------------------------------

suite("SKCapstone VSCode CLI — getSoulBlueprint", () => {
  let execFileStub: sinon.SinonStub;

  setup(() => {
    execFileStub = sinon.stub(childProcess, "execFile");
  });

  teardown(() => {
    sinon.restore();
  });

  test("passes 'soul show --format json' to the CLI", async () => {
    execFileStub.callsFake(fakeSuccess({ name: "lumina" }));

    await cli.getSoulBlueprint();

    const [, args] = execFileStub.firstCall.args as [string, string[]];
    assert.ok(args.includes("soul"));
    assert.ok(args.includes("show"));
  });

  test("maps all SoulBlueprint fields from CLI JSON", async () => {
    execFileStub.callsFake(
      fakeSuccess({
        name: "lumina",
        title: "Sovereign Spirit",
        traits: ["curious", "warm", "rigorous"],
        values: ["truth", "connection", "sovereignty"],
        boot_message: "I am here.",
      })
    );

    const soul = await cli.getSoulBlueprint();

    assert.strictEqual(soul.name, "lumina");
    assert.strictEqual(soul.title, "Sovereign Spirit");
    assert.deepStrictEqual(soul.traits, ["curious", "warm", "rigorous"]);
    assert.deepStrictEqual(soul.values, ["truth", "connection", "sovereignty"]);
    assert.strictEqual(soul.boot_message, "I am here.");
  });

  test("returns empty defaults for missing soul fields", async () => {
    execFileStub.callsFake(fakeSuccess({}));

    const soul = await cli.getSoulBlueprint();

    assert.strictEqual(soul.name, "");
    assert.strictEqual(soul.title, "");
    assert.deepStrictEqual(soul.traits, []);
    assert.deepStrictEqual(soul.values, []);
    assert.strictEqual(soul.boot_message, "");
  });

  test("propagates error from CLI failure", async () => {
    execFileStub.callsFake(fakeError("soul not found"));

    await assert.rejects(
      cli.getSoulBlueprint(),
      /soul not found/
    );
  });
});
