/**
 * Tree view providers for the SKCapstone sidebar.
 *
 * Three panels:
 *   - Agent Status: identity, pillars, consciousness level
 *   - Coordination Board: open tasks with claim/complete actions
 *   - Memories: recent memories with search
 */
import * as vscode from "vscode";
import { CoordTask, Memory } from "./cli";
export declare class StatusProvider implements vscode.TreeDataProvider<StatusItem> {
    private _onDidChangeTreeData;
    readonly onDidChangeTreeData: vscode.Event<StatusItem | undefined>;
    private status;
    refresh(): void;
    getTreeItem(element: StatusItem): vscode.TreeItem;
    getChildren(element?: StatusItem): Promise<StatusItem[]>;
}
declare class StatusItem extends vscode.TreeItem {
    readonly label: string;
    readonly value: string;
    readonly collapsibleState: vscode.TreeItemCollapsibleState;
    readonly iconName: string;
    constructor(label: string, value: string, collapsibleState: vscode.TreeItemCollapsibleState, iconName: string);
}
export declare class CoordProvider implements vscode.TreeDataProvider<CoordItem> {
    private _onDidChangeTreeData;
    readonly onDidChangeTreeData: vscode.Event<CoordItem | undefined>;
    refresh(): void;
    getTreeItem(element: CoordItem): vscode.TreeItem;
    getChildren(element?: CoordItem): Promise<CoordItem[]>;
}
declare class CoordItem extends vscode.TreeItem {
    readonly task: CoordTask;
    constructor(task: CoordTask);
}
export declare class MemoryProvider implements vscode.TreeDataProvider<MemoryItem> {
    private _onDidChangeTreeData;
    readonly onDidChangeTreeData: vscode.Event<MemoryItem | undefined>;
    private lastQuery;
    private memories;
    refresh(): void;
    search(query: string): Promise<void>;
    getTreeItem(element: MemoryItem): vscode.TreeItem;
    getChildren(element?: MemoryItem): Promise<MemoryItem[]>;
}
declare class MemoryItem extends vscode.TreeItem {
    readonly memory: Memory;
    constructor(memory: Memory);
}
export {};
//# sourceMappingURL=views.d.ts.map