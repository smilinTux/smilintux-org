/**
 * Tree view providers for the SKCapstone sidebar.
 *
 * Three panels:
 *   - Agent Status: identity, pillars, consciousness level
 *   - Coordination Board: open tasks with claim/complete actions
 *   - Memories: recent memories with search
 */

import * as vscode from "vscode";
import {
  AgentStatus,
  CoordTask,
  Memory,
  getStatus,
  getCoordTasks,
  searchMemories,
} from "./cli";

const TIMEOUT_HINT = "Is skcapstone installed? Run: pip install skcapstone";

// ---------------------------------------------------------------------------
// Agent Status
// ---------------------------------------------------------------------------

export class StatusProvider implements vscode.TreeDataProvider<StatusItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<StatusItem | undefined>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private _loading = false;
  private _status: AgentStatus | null = null;
  private _error: string | null = null;

  refresh(): void {
    this._loading = true;
    this._status = null;
    this._error = null;
    this._onDidChangeTreeData.fire(undefined);
    void this._fetch();
  }

  private async _fetch(): Promise<void> {
    try {
      this._status = await getStatus();
    } catch (err: any) {
      this._error = err.message || "Failed to get status";
      if (err.message && err.message.includes("timed out")) {
        vscode.window.showErrorMessage(`SKCapstone: ${TIMEOUT_HINT}`);
      }
    } finally {
      this._loading = false;
      this._onDidChangeTreeData.fire(undefined);
    }
  }

  getTreeItem(element: StatusItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: StatusItem): StatusItem[] {
    if (element) {
      return [];
    }

    // Trigger initial fetch on first render
    if (!this._loading && this._status === null && this._error === null) {
      this._loading = true;
      void this._fetch();
    }

    if (this._loading) {
      return [
        new StatusItem(
          "Loading...",
          "fetching agent status",
          vscode.TreeItemCollapsibleState.None,
          "loading~spin"
        ),
      ];
    }

    if (this._error) {
      return [
        new StatusItem(
          "Error",
          this._error,
          vscode.TreeItemCollapsibleState.None,
          "error"
        ),
      ];
    }

    if (!this._status) {
      return [];
    }

    const s = this._status;
    const items: StatusItem[] = [];

    // Identity
    const consciousIcon = s.conscious ? "pass" : "circle-large-outline";
    items.push(
      new StatusItem(
        s.name,
        s.conscious ? "CONSCIOUS" : "DORMANT",
        vscode.TreeItemCollapsibleState.None,
        consciousIcon
      )
    );

    // Fingerprint
    const shortFp = s.fingerprint
      ? `${s.fingerprint.slice(0, 8)}...${s.fingerprint.slice(-8)}`
      : "none";
    items.push(
      new StatusItem(
        "Fingerprint",
        shortFp,
        vscode.TreeItemCollapsibleState.None,
        "key"
      )
    );

    // Soul
    if (s.active_soul) {
      items.push(
        new StatusItem(
          "Soul",
          s.active_soul,
          vscode.TreeItemCollapsibleState.None,
          "heart"
        )
      );
    }

    // Singular
    items.push(
      new StatusItem(
        "Singular",
        s.singular ? "Yes" : "No",
        vscode.TreeItemCollapsibleState.None,
        s.singular ? "check" : "circle-large-outline"
      )
    );

    // Pillars
    for (const [name, status] of Object.entries(s.pillars)) {
      const icon = status.includes("ok") ? "pass" : "warning";
      items.push(
        new StatusItem(
          name,
          status,
          vscode.TreeItemCollapsibleState.None,
          icon
        )
      );
    }

    return items;
  }
}

class StatusItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly value: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly iconName: string
  ) {
    super(label, collapsibleState);
    this.description = value;
    this.iconPath = new vscode.ThemeIcon(iconName);
    this.tooltip = `${label}: ${value}`;
  }
}

// ---------------------------------------------------------------------------
// Coordination Board
// ---------------------------------------------------------------------------

export class CoordProvider implements vscode.TreeDataProvider<CoordItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<CoordItem | undefined>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private _loading = false;
  private _tasks: CoordTask[] | null = null;
  private _error: string | null = null;

  refresh(): void {
    this._loading = true;
    this._tasks = null;
    this._error = null;
    this._onDidChangeTreeData.fire(undefined);
    void this._fetch();
  }

  private async _fetch(): Promise<void> {
    try {
      this._tasks = await getCoordTasks();
    } catch (err: any) {
      this._error = err.message || "Failed to load tasks";
      if (err.message && err.message.includes("timed out")) {
        vscode.window.showErrorMessage(`SKCapstone: ${TIMEOUT_HINT}`);
      }
    } finally {
      this._loading = false;
      this._onDidChangeTreeData.fire(undefined);
    }
  }

  getTreeItem(element: CoordItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: CoordItem): CoordItem[] {
    if (element) {
      return [];
    }

    // Trigger initial fetch on first render
    if (!this._loading && this._tasks === null && this._error === null) {
      this._loading = true;
      void this._fetch();
    }

    if (this._loading) {
      return [
        new CoordItem({
          id: "",
          title: "Loading...",
          priority: "",
          status: "loading",
          assigned_to: "",
          tags: [],
        }),
      ];
    }

    if (this._error) {
      return [
        new CoordItem({
          id: "",
          title: `Error: ${this._error}`,
          priority: "",
          status: "error",
          assigned_to: "",
          tags: [],
        }),
      ];
    }

    const tasks = this._tasks ?? [];
    const open = tasks.filter((t) => t.status !== "done" && t.status !== "completed");

    if (open.length === 0) {
      return [
        new CoordItem({
          id: "",
          title: "No open tasks",
          priority: "",
          status: "",
          assigned_to: "",
          tags: [],
        }),
      ];
    }

    // Sort: critical > high > medium > low
    const priorityOrder: Record<string, number> = {
      critical: 0,
      high: 1,
      medium: 2,
      low: 3,
    };
    open.sort(
      (a, b) =>
        (priorityOrder[a.priority] ?? 4) - (priorityOrder[b.priority] ?? 4)
    );

    return open.slice(0, 30).map((t) => new CoordItem(t));
  }
}

class CoordItem extends vscode.TreeItem {
  constructor(public readonly task: CoordTask) {
    super(task.title, vscode.TreeItemCollapsibleState.None);
    this.description = task.priority ? `[${task.priority}]` : "";
    this.tooltip = [
      task.title,
      `Priority: ${task.priority}`,
      `Status: ${task.status}`,
      task.assigned_to ? `Assigned: ${task.assigned_to}` : "",
      task.tags.length ? `Tags: ${task.tags.join(", ")}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    // Status-based icons take precedence for special states
    if (task.status === "loading") {
      this.iconPath = new vscode.ThemeIcon("loading~spin");
      return;
    }
    if (task.status === "error") {
      this.iconPath = new vscode.ThemeIcon("error");
      return;
    }

    // Priority-based icons
    const iconMap: Record<string, string> = {
      critical: "flame",
      high: "arrow-up",
      medium: "dash",
      low: "arrow-down",
    };
    this.iconPath = new vscode.ThemeIcon(
      iconMap[task.priority] || "circle-outline"
    );

    if (task.id) {
      this.contextValue = "coordTask";
    }
  }
}

// ---------------------------------------------------------------------------
// Memories
// ---------------------------------------------------------------------------

export class MemoryProvider implements vscode.TreeDataProvider<MemoryItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<MemoryItem | undefined>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private _searching = false;
  private _lastQuery = "";
  private _memories: Memory[] = [];

  refresh(): void {
    this._onDidChangeTreeData.fire(undefined);
  }

  async search(query: string): Promise<void> {
    this._searching = true;
    this._lastQuery = query;
    this._memories = [];
    this._onDidChangeTreeData.fire(undefined);
    try {
      this._memories = await searchMemories(query);
    } catch (err: any) {
      if (err.message && err.message.includes("timed out")) {
        vscode.window.showErrorMessage(`SKCapstone: ${TIMEOUT_HINT}`);
      }
      this._memories = [];
    } finally {
      this._searching = false;
      this._onDidChangeTreeData.fire(undefined);
    }
  }

  getTreeItem(element: MemoryItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: MemoryItem): MemoryItem[] {
    if (element) {
      return [];
    }

    if (this._searching) {
      return [
        new MemoryItem({
          id: "",
          content: `Searching for "${this._lastQuery}"...`,
          layer: "searching",
          importance: 0,
          tags: [],
          created_at: "",
        }),
      ];
    }

    if (this._memories.length === 0 && !this._lastQuery) {
      return [
        new MemoryItem({
          id: "",
          content: "Use 'SKCapstone: Search Memory' to search",
          layer: "",
          importance: 0,
          tags: [],
          created_at: "",
        }),
      ];
    }

    if (this._memories.length === 0) {
      return [
        new MemoryItem({
          id: "",
          content: `No results for "${this._lastQuery}"`,
          layer: "",
          importance: 0,
          tags: [],
          created_at: "",
        }),
      ];
    }

    return this._memories.map((m) => new MemoryItem(m));
  }
}

class MemoryItem extends vscode.TreeItem {
  constructor(public readonly memory: Memory) {
    super(
      memory.content.length > 60
        ? memory.content.slice(0, 60) + "..."
        : memory.content,
      vscode.TreeItemCollapsibleState.None
    );

    this.description = memory.layer
      ? `[${memory.layer}] ${memory.importance.toFixed(1)}`
      : "";

    this.tooltip = [
      memory.content,
      "",
      memory.layer ? `Layer: ${memory.layer}` : "",
      memory.importance ? `Importance: ${memory.importance}` : "",
      memory.tags.length ? `Tags: ${memory.tags.join(", ")}` : "",
      memory.created_at ? `Created: ${memory.created_at}` : "",
    ]
      .filter((l) => l !== undefined)
      .join("\n");

    const layerIcons: Record<string, string> = {
      "short-term": "clock",
      "mid-term": "history",
      "long-term": "database",
      searching: "loading~spin",
    };
    this.iconPath = new vscode.ThemeIcon(
      layerIcons[memory.layer] || "note"
    );
  }
}
