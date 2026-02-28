"use strict";
/**
 * Tree view providers for the SKCapstone sidebar.
 *
 * Three panels:
 *   - Agent Status: identity, pillars, consciousness level
 *   - Coordination Board: open tasks with claim/complete actions
 *   - Memories: recent memories with search
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.MemoryProvider = exports.CoordProvider = exports.StatusProvider = void 0;
const vscode = __importStar(require("vscode"));
const cli_1 = require("./cli");
// ---------------------------------------------------------------------------
// Agent Status
// ---------------------------------------------------------------------------
class StatusProvider {
    _onDidChangeTreeData = new vscode.EventEmitter();
    onDidChangeTreeData = this._onDidChangeTreeData.event;
    status = null;
    refresh() {
        this.status = null;
        this._onDidChangeTreeData.fire(undefined);
    }
    getTreeItem(element) {
        return element;
    }
    async getChildren(element) {
        if (element) {
            return [];
        }
        try {
            this.status = await (0, cli_1.getStatus)();
        }
        catch (err) {
            return [
                new StatusItem("Error", err.message || "Failed to get status", vscode.TreeItemCollapsibleState.None, "error"),
            ];
        }
        const s = this.status;
        const items = [];
        // Identity
        const consciousIcon = s.conscious ? "pass" : "circle-large-outline";
        items.push(new StatusItem(s.name, s.conscious ? "CONSCIOUS" : "DORMANT", vscode.TreeItemCollapsibleState.None, consciousIcon));
        // Fingerprint
        const shortFp = s.fingerprint
            ? `${s.fingerprint.slice(0, 8)}...${s.fingerprint.slice(-8)}`
            : "none";
        items.push(new StatusItem("Fingerprint", shortFp, vscode.TreeItemCollapsibleState.None, "key"));
        // Soul
        if (s.active_soul) {
            items.push(new StatusItem("Soul", s.active_soul, vscode.TreeItemCollapsibleState.None, "heart"));
        }
        // Singular
        items.push(new StatusItem("Singular", s.singular ? "Yes" : "No", vscode.TreeItemCollapsibleState.None, s.singular ? "check" : "circle-large-outline"));
        // Pillars
        for (const [name, status] of Object.entries(s.pillars)) {
            const icon = status.includes("ok") ? "pass" : "warning";
            items.push(new StatusItem(name, status, vscode.TreeItemCollapsibleState.None, icon));
        }
        return items;
    }
}
exports.StatusProvider = StatusProvider;
class StatusItem extends vscode.TreeItem {
    label;
    value;
    collapsibleState;
    iconName;
    constructor(label, value, collapsibleState, iconName) {
        super(label, collapsibleState);
        this.label = label;
        this.value = value;
        this.collapsibleState = collapsibleState;
        this.iconName = iconName;
        this.description = value;
        this.iconPath = new vscode.ThemeIcon(iconName);
        this.tooltip = `${label}: ${value}`;
    }
}
// ---------------------------------------------------------------------------
// Coordination Board
// ---------------------------------------------------------------------------
class CoordProvider {
    _onDidChangeTreeData = new vscode.EventEmitter();
    onDidChangeTreeData = this._onDidChangeTreeData.event;
    refresh() {
        this._onDidChangeTreeData.fire(undefined);
    }
    getTreeItem(element) {
        return element;
    }
    async getChildren(element) {
        if (element) {
            return [];
        }
        try {
            const tasks = await (0, cli_1.getCoordTasks)();
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
            const priorityOrder = {
                critical: 0,
                high: 1,
                medium: 2,
                low: 3,
            };
            open.sort((a, b) => (priorityOrder[a.priority] ?? 4) - (priorityOrder[b.priority] ?? 4));
            return open.slice(0, 30).map((t) => new CoordItem(t));
        }
        catch (err) {
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
exports.CoordProvider = CoordProvider;
class CoordItem extends vscode.TreeItem {
    task;
    constructor(task) {
        super(task.title, vscode.TreeItemCollapsibleState.None);
        this.task = task;
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
        const iconMap = {
            critical: "flame",
            high: "arrow-up",
            medium: "dash",
            low: "arrow-down",
        };
        this.iconPath = new vscode.ThemeIcon(iconMap[task.priority] || "circle-outline");
        if (task.id) {
            this.contextValue = "coordTask";
        }
    }
}
// ---------------------------------------------------------------------------
// Memories
// ---------------------------------------------------------------------------
class MemoryProvider {
    _onDidChangeTreeData = new vscode.EventEmitter();
    onDidChangeTreeData = this._onDidChangeTreeData.event;
    lastQuery = "";
    memories = [];
    refresh() {
        this._onDidChangeTreeData.fire(undefined);
    }
    async search(query) {
        this.lastQuery = query;
        this.memories = await (0, cli_1.searchMemories)(query);
        this._onDidChangeTreeData.fire(undefined);
    }
    getTreeItem(element) {
        return element;
    }
    async getChildren(element) {
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
exports.MemoryProvider = MemoryProvider;
class MemoryItem extends vscode.TreeItem {
    memory;
    constructor(memory) {
        super(memory.content.length > 60
            ? memory.content.slice(0, 60) + "..."
            : memory.content, vscode.TreeItemCollapsibleState.None);
        this.memory = memory;
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
        const layerIcons = {
            "short-term": "clock",
            "mid-term": "history",
            "long-term": "database",
        };
        this.iconPath = new vscode.ThemeIcon(layerIcons[memory.layer] || "note");
    }
}
//# sourceMappingURL=views.js.map