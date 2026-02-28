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

// ---------------------------------------------------------------------------
// Agent Status
// ---------------------------------------------------------------------------

export class StatusProvider implements vscode.TreeDataProvider<StatusItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<StatusItem | undefined>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private status: AgentStatus | null = null;

  refresh(): void {
    this.status = null;
    this._onDidChangeTreeData.fire(undefined);
  }

  getTreeItem(element: StatusItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: StatusItem): Promise<StatusItem[]> {
    if (element) {
      return [];
    }

    try {
      this.status = await getStatus();
    } catch (err: any) {
      return [
        new StatusItem(
          "Error",
          err.message || "Failed to get status",
          vscode.TreeItemCollapsibleState.None,
          "error"
        ),
      ];
    }

    const s = this.status;
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

  refresh(): void {
    this._onDidChangeTreeData.fire(undefined);
  }

  getTreeItem(element: CoordItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: CoordItem): Promise<CoordItem[]> {
    if (element) {
      return [];
    }

    try {
      const tasks = await getCoordTasks();
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
    } catch (err: any) {
      return [
        new CoordItem({
          id: "",
          title: `Error: ${err.message}`,
          priority: "",
          status: "error",
          assigned_to: "",
          tags: [],
        }),
      ];
    }
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

  private lastQuery = "";
  private memories: Memory[] = [];

  refresh(): void {
    this._onDidChangeTreeData.fire(undefined);
  }

  async search(query: string): Promise<void> {
    this.lastQuery = query;
    this.memories = await searchMemories(query);
    this._onDidChangeTreeData.fire(undefined);
  }

  getTreeItem(element: MemoryItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: MemoryItem): Promise<MemoryItem[]> {
    if (element) {
      return [];
    }

    if (this.memories.length === 0 && !this.lastQuery) {
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

    if (this.memories.length === 0) {
      return [
        new MemoryItem({
          id: "",
          content: `No results for "${this.lastQuery}"`,
          layer: "",
          importance: 0,
          tags: [],
          created_at: "",
        }),
      ];
    }

    return this.memories.map((m) => new MemoryItem(m));
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
    };
    this.iconPath = new vscode.ThemeIcon(
      layerIcons[memory.layer] || "note"
    );
  }
}
