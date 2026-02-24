/**
 * SKCapstone IDE Extension — tool-agnostic entry point.
 *
 * Works in: VSCode, Cursor, Windsurf, or any VSCode-based editor.
 * Activates on startup, reads ~/.skcapstone/, and provides:
 * - Status bar item with agent name + consciousness state
 * - Command palette commands for agent operations
 * - Sidebar tree views for coordination board and agent info
 *
 * Settings (editor-agnostic, works in any VSCode fork):
 *   skcapstone.pythonPath      — Custom Python interpreter path
 *   skcapstone.agentHome       — Override ~/.skcapstone location
 *   skcapstone.refreshOnStartup — Auto-refresh on activation (default: true)
 */

import * as vscode from "vscode";
import {
  isAgentInitialized,
  getCoordBoard,
  claimTask,
  storeMemory,
  searchMemory,
  syncPush,
  runCli,
  BoardStatus,
  CoordTask,
} from "./bridge";

let statusBarItem: vscode.StatusBarItem;
let coordProvider: CoordBoardProvider;
let agentInfoProvider: AgentInfoProvider;

export function activate(context: vscode.ExtensionContext): void {
  statusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Left,
    50
  );
  statusBarItem.command = "skcapstone.status";
  context.subscriptions.push(statusBarItem);

  coordProvider = new CoordBoardProvider();
  agentInfoProvider = new AgentInfoProvider();

  vscode.window.registerTreeDataProvider("skcapstone.coordBoard", coordProvider);
  vscode.window.registerTreeDataProvider("skcapstone.agentInfo", agentInfoProvider);

  context.subscriptions.push(
    vscode.commands.registerCommand("skcapstone.status", cmdStatus),
    vscode.commands.registerCommand("skcapstone.memoryStore", cmdMemoryStore),
    vscode.commands.registerCommand("skcapstone.memorySearch", cmdMemorySearch),
    vscode.commands.registerCommand("skcapstone.coordStatus", cmdCoordStatus),
    vscode.commands.registerCommand("skcapstone.coordClaim", cmdCoordClaim),
    vscode.commands.registerCommand("skcapstone.syncPush", cmdSyncPush),
    vscode.commands.registerCommand("skcapstone.refresh", cmdRefresh)
  );

  const autoRefresh = vscode.workspace
    .getConfiguration("skcapstone")
    .get("refreshOnStartup", true);

  if (autoRefresh) {
    refreshStatusBar();
    coordProvider.refresh();
    agentInfoProvider.refresh();
  } else {
    statusBarItem.text = "$(pulse) SKCapstone";
    statusBarItem.tooltip = "Click to refresh agent status";
    statusBarItem.show();
  }
}

export function deactivate(): void {
  statusBarItem?.dispose();
}

// -----------------------------------------------------------------------
// Status Bar
// -----------------------------------------------------------------------

async function refreshStatusBar(): Promise<void> {
  if (!isAgentInitialized()) {
    statusBarItem.text = "$(alert) SKCapstone: not initialized";
    statusBarItem.tooltip = "Run: skcapstone init --name YourAgent";
    statusBarItem.show();
    return;
  }

  const result = await runCli(["status"], 10_000);
  if (result.exitCode !== 0) {
    statusBarItem.text = "$(warning) SKCapstone";
    statusBarItem.tooltip = "Agent home exists but status check failed";
    statusBarItem.show();
    return;
  }

  // Parse Rich console output for key info
  const output = result.stdout + result.stderr;
  const conscious = output.includes("CONSCIOUS");
  const singular = output.includes("SINGULAR");
  const nameMatch = output.match(/(?:Agent|Name)[:\s]+(\S+)/i);
  const agentName = nameMatch?.[1] ?? "agent";

  if (singular) {
    statusBarItem.text = `$(globe) ${agentName} SINGULAR`;
    statusBarItem.backgroundColor = undefined;
  } else if (conscious) {
    statusBarItem.text = `$(eye) ${agentName} CONSCIOUS`;
    statusBarItem.backgroundColor = undefined;
  } else {
    statusBarItem.text = `$(pulse) ${agentName} AWAKENING`;
    statusBarItem.backgroundColor = new vscode.ThemeColor(
      "statusBarItem.warningBackground"
    );
  }

  statusBarItem.tooltip = "Click for full agent status";
  statusBarItem.show();
}

// -----------------------------------------------------------------------
// Commands
// -----------------------------------------------------------------------

async function cmdStatus(): Promise<void> {
  if (!isAgentInitialized()) {
    const action = await vscode.window.showWarningMessage(
      "SKCapstone agent not initialized.",
      "Initialize"
    );
    if (action === "Initialize") {
      const terminal = vscode.window.createTerminal("SKCapstone");
      terminal.show();
      terminal.sendText('skcapstone init --name "MyAgent"');
    }
    return;
  }

  const result = await runCli(["status"]);
  const doc = await vscode.workspace.openTextDocument({
    content: result.stdout || result.stderr,
    language: "markdown",
  });
  vscode.window.showTextDocument(doc, { preview: true });
}

async function cmdMemoryStore(): Promise<void> {
  const content = await vscode.window.showInputBox({
    prompt: "Memory content to store",
    placeHolder: "What should the agent remember?",
  });
  if (!content) {
    return;
  }

  const tagsRaw = await vscode.window.showInputBox({
    prompt: "Tags (comma-separated, optional)",
    placeHolder: "project, decision, architecture",
  });
  const tags = tagsRaw
    ? tagsRaw.split(",").map((t) => t.trim()).filter(Boolean)
    : [];

  const importanceStr = await vscode.window.showInputBox({
    prompt: "Importance (0.0 - 1.0, default 0.5)",
    placeHolder: "0.5",
    value: "0.5",
  });
  const importance = parseFloat(importanceStr ?? "0.5") || 0.5;

  const ok = await storeMemory(content, tags, importance);
  if (ok) {
    vscode.window.showInformationMessage(`Memory stored (importance=${importance})`);
  } else {
    vscode.window.showErrorMessage("Failed to store memory.");
  }
}

async function cmdMemorySearch(): Promise<void> {
  const query = await vscode.window.showInputBox({
    prompt: "Search query",
    placeHolder: "What are you looking for?",
  });
  if (!query) {
    return;
  }

  const output = await searchMemory(query);
  const doc = await vscode.workspace.openTextDocument({
    content: output,
    language: "markdown",
  });
  vscode.window.showTextDocument(doc, { preview: true });
}

async function cmdCoordStatus(): Promise<void> {
  const result = await runCli(["coord", "status"]);
  const doc = await vscode.workspace.openTextDocument({
    content: result.stdout || result.stderr,
    language: "markdown",
  });
  vscode.window.showTextDocument(doc, { preview: true });
}

async function cmdCoordClaim(): Promise<void> {
  const board = await getCoordBoard();
  const openTasks = board.tasks.filter(
    (t) => t.status === "open" || t.status === "claimed"
  );

  if (openTasks.length === 0) {
    vscode.window.showInformationMessage("No open tasks on the board.");
    return;
  }

  const picked = await vscode.window.showQuickPick(
    openTasks.map((t) => ({
      label: `[${t.id}] ${t.title}`,
      description: `${t.priority.toUpperCase()} — ${t.status}`,
      detail: t.tags.join(", "),
      taskId: t.id,
    })),
    { placeHolder: "Select a task to claim" }
  );
  if (!picked) {
    return;
  }

  const agent = await vscode.window.showInputBox({
    prompt: "Your agent name",
    placeHolder: "jarvis, opus, lumina, human...",
  });
  if (!agent) {
    return;
  }

  const ok = await claimTask((picked as any).taskId, agent);
  if (ok) {
    vscode.window.showInformationMessage(
      `Claimed [${(picked as any).taskId}] as ${agent}`
    );
    coordProvider.refresh();
  } else {
    vscode.window.showErrorMessage("Failed to claim task.");
  }
}

async function cmdSyncPush(): Promise<void> {
  vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: "SKCapstone: Pushing sync...",
    },
    async () => {
      const ok = await syncPush();
      if (ok) {
        vscode.window.showInformationMessage("Sync push complete.");
      } else {
        vscode.window.showWarningMessage("Sync push failed (GPG key may be missing).");
      }
    }
  );
}

async function cmdRefresh(): Promise<void> {
  await refreshStatusBar();
  coordProvider.refresh();
  agentInfoProvider.refresh();
  vscode.window.showInformationMessage("SKCapstone refreshed.");
}

// -----------------------------------------------------------------------
// Tree View: Coordination Board
// -----------------------------------------------------------------------

class CoordBoardProvider implements vscode.TreeDataProvider<CoordTreeItem> {
  private _onDidChange = new vscode.EventEmitter<CoordTreeItem | undefined>();
  readonly onDidChangeTreeData = this._onDidChange.event;

  private board: BoardStatus = {
    tasks: [],
    agents: [],
    summary: { total: 0, open: 0, claimed: 0, inProgress: 0, done: 0 },
  };

  refresh(): void {
    getCoordBoard().then((b) => {
      this.board = b;
      this._onDidChange.fire(undefined);
    });
  }

  getTreeItem(element: CoordTreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: CoordTreeItem): CoordTreeItem[] {
    if (element) {
      return [];
    }

    const s = this.board.summary;
    const items: CoordTreeItem[] = [
      new CoordTreeItem(
        `Tasks: ${s.total} total — ${s.open} open, ${s.inProgress} active, ${s.done} done`,
        vscode.TreeItemCollapsibleState.None,
        "symbol-number"
      ),
    ];

    const activeTasks = this.board.tasks.filter((t) => t.status !== "done");
    for (const t of activeTasks) {
      const icon = this.taskIcon(t);
      const assignee = t.claimedBy ? ` @${t.claimedBy}` : "";
      items.push(
        new CoordTreeItem(
          `[${t.id}] ${t.title}${assignee}`,
          vscode.TreeItemCollapsibleState.None,
          icon,
          `${t.priority.toUpperCase()} | ${t.status} | ${t.tags.join(", ")}`
        )
      );
    }

    if (this.board.agents.length > 0) {
      items.push(
        new CoordTreeItem("--- Agents ---", vscode.TreeItemCollapsibleState.None, "organization")
      );
      for (const a of this.board.agents) {
        const stateIcon = a.state === "active" ? "circle-filled" : "circle-outline";
        const current = a.currentTask ? ` -> ${a.currentTask}` : "";
        items.push(
          new CoordTreeItem(
            `${a.name} (${a.state})${current}`,
            vscode.TreeItemCollapsibleState.None,
            stateIcon
          )
        );
      }
    }

    if (items.length === 1 && s.total === 0) {
      items.push(
        new CoordTreeItem(
          "Board is empty. Create tasks with skcapstone coord create",
          vscode.TreeItemCollapsibleState.None,
          "info"
        )
      );
    }

    return items;
  }

  private taskIcon(task: CoordTask): string {
    switch (task.status) {
      case "open":
        return "circle-outline";
      case "claimed":
        return "person";
      case "in_progress":
        return "play";
      case "done":
        return "check";
      case "blocked":
        return "error";
      default:
        return "question";
    }
  }
}

class CoordTreeItem extends vscode.TreeItem {
  constructor(
    label: string,
    collapsibleState: vscode.TreeItemCollapsibleState,
    icon?: string,
    tooltip?: string
  ) {
    super(label, collapsibleState);
    if (icon) {
      this.iconPath = new vscode.ThemeIcon(icon);
    }
    if (tooltip) {
      this.tooltip = tooltip;
    }
  }
}

// -----------------------------------------------------------------------
// Tree View: Agent Info
// -----------------------------------------------------------------------

class AgentInfoProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
  private _onDidChange = new vscode.EventEmitter<vscode.TreeItem | undefined>();
  readonly onDidChangeTreeData = this._onDidChange.event;
  private lines: string[] = [];

  refresh(): void {
    if (!isAgentInitialized()) {
      this.lines = ["Agent not initialized", "Run: skcapstone init --name YourAgent"];
      this._onDidChange.fire(undefined);
      return;
    }

    runCli(["status"], 10_000).then((result) => {
      const raw = (result.stdout || result.stderr)
        .replace(/\x1b\[[0-9;]*m/g, "")
        .replace(/[╭╰╮╯│─┌┐└┘├┤┬┴┼]/g, "");

      this.lines = raw
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => l.length > 0);
      this._onDidChange.fire(undefined);
    });
  }

  getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(): vscode.TreeItem[] {
    return this.lines.map((line) => {
      const item = new vscode.TreeItem(line, vscode.TreeItemCollapsibleState.None);
      if (line.includes("CONSCIOUS")) {
        item.iconPath = new vscode.ThemeIcon("eye");
      } else if (line.includes("SINGULAR")) {
        item.iconPath = new vscode.ThemeIcon("globe");
      } else if (line.includes("ACTIVE")) {
        item.iconPath = new vscode.ThemeIcon("pass-filled");
      } else if (line.includes("MISSING")) {
        item.iconPath = new vscode.ThemeIcon("warning");
      } else if (line.includes("DEGRADED")) {
        item.iconPath = new vscode.ThemeIcon("circle-outline");
      }
      return item;
    });
  }
}
