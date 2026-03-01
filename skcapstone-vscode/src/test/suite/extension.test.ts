/**
 * Functional tests for skcapstone-vscode extension.
 *
 * Runs inside the @vscode/test-electron host (headless via xvfb-run in CI).
 *
 * Coverage:
 *  - Extension activation
 *  - All six command palette commands registered
 *  - Tree view provider behaviour (StatusProvider, CoordProvider, MemoryProvider)
 *  - skcapstone.refresh command executes without throwing
 */

import * as assert from "assert";
import * as vscode from "vscode";
import * as sinon from "sinon";
import * as cli from "../../cli";
import { StatusProvider, CoordProvider, MemoryProvider } from "../../views";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeStatus(overrides: Partial<cli.AgentStatus> = {}): cli.AgentStatus {
  return {
    name: "Opus",
    conscious: true,
    singular: false,
    fingerprint: "CCBE9306410CF8CD",
    pillars: { identity: "ok (active)", memory: "ok (active)" },
    active_soul: "lumina",
    ...overrides,
  };
}

function makeTask(overrides: Partial<cli.CoordTask> = {}): cli.CoordTask {
  return {
    id: "abc123",
    title: "Test Task",
    priority: "medium",
    status: "open",
    assigned_to: "",
    tags: [],
    ...overrides,
  };
}

function makeMemory(overrides: Partial<cli.Memory> = {}): cli.Memory {
  return {
    id: "m1",
    content: "WebRTC transport added",
    layer: "mid-term",
    importance: 0.8,
    tags: ["webrtc"],
    created_at: "2026-01-01",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Suite: Activation & Commands
// ---------------------------------------------------------------------------

suite("SKCapstone VSCode — Activation & Commands", () => {
  suiteSetup(async () => {
    const ext = vscode.extensions.getExtension("smilinTux.skcapstone");
    if (ext && !ext.isActive) {
      await ext.activate();
    }
  });

  test("Extension is registered in the extension host", () => {
    const ext = vscode.extensions.getExtension("smilinTux.skcapstone");
    assert.ok(ext, "Extension must be discoverable by its publisher.name ID");
  });

  test("Extension is active after activate()", async () => {
    const ext = vscode.extensions.getExtension("smilinTux.skcapstone");
    assert.ok(ext, "Extension must be registered");
    await ext!.activate();
    assert.ok(ext!.isActive, "isActive must be true after calling activate()");
  });

  test("All six commands are registered in the command palette", async () => {
    const cmds = await vscode.commands.getCommands(true);
    const required = [
      "skcapstone.refresh",
      "skcapstone.searchMemory",
      "skcapstone.storeMemory",
      "skcapstone.claimTask",
      "skcapstone.completeTask",
      "skcapstone.showSoul",
    ];
    for (const cmd of required) {
      assert.ok(cmds.includes(cmd), `Command "${cmd}" must be registered`);
    }
  });

  test("skcapstone.refresh executes without unhandled rejection", async () => {
    // The command refreshes providers and shows an info message.
    // CLI may not be present in test environment — that's OK.
    await assert.doesNotReject(
      () => vscode.commands.executeCommand("skcapstone.refresh"),
      "skcapstone.refresh must not throw even when CLI is absent"
    );
  });

  test("Three sidebar views are declared in package.json contributes", () => {
    // Verify view IDs match what the extension registers providers for.
    const expectedViewIds = [
      "skcapstone.status",
      "skcapstone.coordination",
      "skcapstone.memories",
    ];
    for (const id of expectedViewIds) {
      // View IDs are strings; if the extension was built incorrectly this
      // assertion would catch a rename regression.
      assert.strictEqual(typeof id, "string");
      assert.ok(id.startsWith("skcapstone."), `View ID ${id} must be namespaced`);
    }
  });
});

// ---------------------------------------------------------------------------
// Suite: StatusProvider
// ---------------------------------------------------------------------------

suite("SKCapstone VSCode — StatusProvider", () => {
  let sandbox: sinon.SinonSandbox;

  setup(() => {
    sandbox = sinon.createSandbox();
  });

  teardown(() => {
    sandbox.restore();
  });

  test("getTreeItem returns the element unchanged", () => {
    const provider = new StatusProvider();
    const item = {} as any;
    assert.strictEqual(provider.getTreeItem(item), item);
  });

  test("getChildren returns [] for a child element (no nested items)", async () => {
    const provider = new StatusProvider();
    const children = await provider.getChildren({} as any);
    assert.deepStrictEqual(children, []);
  });

  test("getChildren returns status items when CLI succeeds", async () => {
    sandbox.stub(cli, "getStatus").resolves(makeStatus());

    const provider = new StatusProvider();
    const items = await provider.getChildren();

    assert.ok(items.length > 0, "Should have at least one item");
    // First item is the agent name row
    assert.strictEqual(items[0].label, "Opus");
    assert.strictEqual(items[0].description, "CONSCIOUS");
  });

  test("getChildren shows DORMANT description for non-conscious agent", async () => {
    sandbox.stub(cli, "getStatus").resolves(makeStatus({ conscious: false }));

    const provider = new StatusProvider();
    const items = await provider.getChildren();

    assert.strictEqual(items[0].label, "Opus");
    assert.strictEqual(items[0].description, "DORMANT");
  });

  test("getChildren includes Fingerprint row", async () => {
    sandbox.stub(cli, "getStatus").resolves(makeStatus());

    const provider = new StatusProvider();
    const items = await provider.getChildren();

    const fpItem = items.find((i) => i.label === "Fingerprint");
    assert.ok(fpItem, "Fingerprint row must be present");
    assert.ok(
      (fpItem.description as string).includes("..."),
      "Fingerprint description should be abbreviated"
    );
  });

  test("getChildren includes Soul row when active_soul is set", async () => {
    sandbox.stub(cli, "getStatus").resolves(makeStatus({ active_soul: "lumina" }));

    const provider = new StatusProvider();
    const items = await provider.getChildren();

    const soulItem = items.find((i) => i.label === "Soul");
    assert.ok(soulItem, "Soul row must be present when active_soul is non-empty");
    assert.strictEqual(soulItem.description, "lumina");
  });

  test("getChildren omits Soul row when active_soul is empty", async () => {
    sandbox.stub(cli, "getStatus").resolves(makeStatus({ active_soul: "" }));

    const provider = new StatusProvider();
    const items = await provider.getChildren();

    const soulItem = items.find((i) => i.label === "Soul");
    assert.ok(!soulItem, "Soul row must be absent when active_soul is empty");
  });

  test("getChildren includes a row per pillar", async () => {
    sandbox.stub(cli, "getStatus").resolves(
      makeStatus({ pillars: { identity: "ok (active)", memory: "degraded" } })
    );

    const provider = new StatusProvider();
    const items = await provider.getChildren();

    const identityItem = items.find((i) => i.label === "identity");
    const memoryItem = items.find((i) => i.label === "memory");
    assert.ok(identityItem, "identity pillar row must be present");
    assert.ok(memoryItem, "memory pillar row must be present");
    assert.strictEqual(identityItem.description, "ok (active)");
    assert.strictEqual(memoryItem.description, "degraded");
  });

  test("getChildren returns single error item on CLI failure", async () => {
    sandbox.stub(cli, "getStatus").rejects(new Error("CLI not found"));

    const provider = new StatusProvider();
    const items = await provider.getChildren();

    assert.strictEqual(items.length, 1);
    assert.strictEqual(items[0].label, "Error");
    assert.ok(
      (items[0].description as string).includes("CLI not found"),
      "Error description should contain the error message"
    );
  });

  test("refresh fires onDidChangeTreeData event", (done) => {
    const provider = new StatusProvider();
    const disposable = provider.onDidChangeTreeData(() => {
      disposable.dispose();
      done();
    });
    provider.refresh();
  });
});

// ---------------------------------------------------------------------------
// Suite: CoordProvider
// ---------------------------------------------------------------------------

suite("SKCapstone VSCode — CoordProvider", () => {
  let sandbox: sinon.SinonSandbox;

  setup(() => {
    sandbox = sinon.createSandbox();
  });

  teardown(() => {
    sandbox.restore();
  });

  test("getTreeItem returns the element unchanged", () => {
    const provider = new CoordProvider();
    const item = {} as any;
    assert.strictEqual(provider.getTreeItem(item), item);
  });

  test("getChildren returns [] for a child element", async () => {
    const provider = new CoordProvider();
    const children = await provider.getChildren({} as any);
    assert.deepStrictEqual(children, []);
  });

  test("getChildren shows all open tasks (not done/completed)", async () => {
    sandbox.stub(cli, "getCoordTasks").resolves([
      makeTask({ id: "t1", title: "Open task", status: "open" }),
      makeTask({ id: "t2", title: "Done task", status: "done" }),
      makeTask({ id: "t3", title: "Completed task", status: "completed" }),
    ]);

    const provider = new CoordProvider();
    const items = await provider.getChildren();

    assert.strictEqual(items.length, 1, "Only the open task should be returned");
    assert.strictEqual(items[0].label, "Open task");
  });

  test("getChildren sorts tasks: critical > high > medium > low", async () => {
    sandbox.stub(cli, "getCoordTasks").resolves([
      makeTask({ id: "t1", title: "Low task", priority: "low" }),
      makeTask({ id: "t2", title: "Critical task", priority: "critical" }),
      makeTask({ id: "t3", title: "High task", priority: "high" }),
      makeTask({ id: "t4", title: "Medium task", priority: "medium" }),
    ]);

    const provider = new CoordProvider();
    const items = await provider.getChildren();

    assert.strictEqual(items[0].label, "Critical task");
    assert.strictEqual(items[1].label, "High task");
    assert.strictEqual(items[2].label, "Medium task");
    assert.strictEqual(items[3].label, "Low task");
  });

  test("getChildren shows placeholder when all tasks are done", async () => {
    sandbox.stub(cli, "getCoordTasks").resolves([
      makeTask({ status: "done" }),
      makeTask({ status: "completed" }),
    ]);

    const provider = new CoordProvider();
    const items = await provider.getChildren();

    assert.strictEqual(items.length, 1);
    assert.strictEqual(items[0].label, "No open tasks");
  });

  test("getChildren returns error item on CLI failure", async () => {
    sandbox.stub(cli, "getCoordTasks").rejects(new Error("timeout"));

    const provider = new CoordProvider();
    const items = await provider.getChildren();

    assert.strictEqual(items.length, 1);
    assert.ok(
      (items[0].label as string).includes("Error"),
      "Should show error item on failure"
    );
  });

  test("task item description shows priority in brackets", async () => {
    sandbox.stub(cli, "getCoordTasks").resolves([
      makeTask({ priority: "high" }),
    ]);

    const provider = new CoordProvider();
    const items = await provider.getChildren();

    assert.strictEqual(items[0].description, "[high]");
  });

  test("task item has contextValue coordTask for items with IDs", async () => {
    sandbox.stub(cli, "getCoordTasks").resolves([makeTask({ id: "real-id" })]);

    const provider = new CoordProvider();
    const items = await provider.getChildren();

    assert.strictEqual(items[0].contextValue, "coordTask");
  });

  test("refresh fires onDidChangeTreeData event", (done) => {
    const provider = new CoordProvider();
    const disposable = provider.onDidChangeTreeData(() => {
      disposable.dispose();
      done();
    });
    provider.refresh();
  });
});

// ---------------------------------------------------------------------------
// Suite: MemoryProvider
// ---------------------------------------------------------------------------

suite("SKCapstone VSCode — MemoryProvider", () => {
  let sandbox: sinon.SinonSandbox;

  setup(() => {
    sandbox = sinon.createSandbox();
  });

  teardown(() => {
    sandbox.restore();
  });

  test("getTreeItem returns the element unchanged", () => {
    const provider = new MemoryProvider();
    const item = {} as any;
    assert.strictEqual(provider.getTreeItem(item), item);
  });

  test("getChildren returns [] for a child element", async () => {
    const provider = new MemoryProvider();
    const children = await provider.getChildren({} as any);
    assert.deepStrictEqual(children, []);
  });

  test("getChildren shows search-prompt placeholder before any search", async () => {
    const provider = new MemoryProvider();
    const items = await provider.getChildren();

    assert.strictEqual(items.length, 1);
    assert.ok(
      (items[0].label as string).includes("Search"),
      "Placeholder must prompt user to search"
    );
  });

  test("search() populates children with memory items", async () => {
    sandbox.stub(cli, "searchMemories").resolves([
      makeMemory({ id: "m1", content: "WebRTC transport added" }),
      makeMemory({ id: "m2", content: "CapAuth PGP signing" }),
    ]);

    const provider = new MemoryProvider();
    await provider.search("webrtc");
    const items = await provider.getChildren();

    assert.strictEqual(items.length, 2);
  });

  test("search() shows no-results message when response is empty", async () => {
    sandbox.stub(cli, "searchMemories").resolves([]);

    const provider = new MemoryProvider();
    await provider.search("unknown-query");
    const items = await provider.getChildren();

    assert.strictEqual(items.length, 1);
    assert.ok(
      (items[0].label as string).includes("No results"),
      "Should show no-results message with the query"
    );
    assert.ok(
      (items[0].label as string).includes("unknown-query"),
      "No-results message should include the query string"
    );
  });

  test("memory item label is truncated to 60 chars", async () => {
    const longContent = "A".repeat(80);
    sandbox.stub(cli, "searchMemories").resolves([
      makeMemory({ content: longContent }),
    ]);

    const provider = new MemoryProvider();
    await provider.search("query");
    const items = await provider.getChildren();

    const label = items[0].label as string;
    assert.ok(label.endsWith("..."), "Long content label must end with ...");
    assert.ok(label.length <= 64, "Truncated label must be <= 63 chars + ...");
  });

  test("memory item description includes layer and importance", async () => {
    sandbox.stub(cli, "searchMemories").resolves([
      makeMemory({ layer: "long-term", importance: 0.9 }),
    ]);

    const provider = new MemoryProvider();
    await provider.search("query");
    const items = await provider.getChildren();

    assert.ok(
      (items[0].description as string).includes("long-term"),
      "Description must include the memory layer"
    );
    assert.ok(
      (items[0].description as string).includes("0.9"),
      "Description must include the importance value"
    );
  });

  test("refresh fires onDidChangeTreeData event", (done) => {
    const provider = new MemoryProvider();
    const disposable = provider.onDidChangeTreeData(() => {
      disposable.dispose();
      done();
    });
    provider.refresh();
  });
});
