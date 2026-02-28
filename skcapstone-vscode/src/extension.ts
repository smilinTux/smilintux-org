/**
 * SKCapstone VSCode Extension — Sovereign Agent Integration.
 *
 * Provides a sidebar with agent status, coordination board, and memory
 * search. All operations go through the skcapstone CLI.
 */

import * as vscode from "vscode";
import {
  claimTask,
  completeTask,
  getSoulBlueprint,
  storeMemory,
} from "./cli";
import { CoordProvider, MemoryProvider, StatusProvider } from "./views";

let refreshTimer: NodeJS.Timeout | undefined;

export function activate(context: vscode.ExtensionContext): void {
  // Create tree view providers
  const statusProvider = new StatusProvider();
  const coordProvider = new CoordProvider();
  const memoryProvider = new MemoryProvider();

  // Register tree views
  context.subscriptions.push(
    vscode.window.registerTreeDataProvider("skcapstone.status", statusProvider),
    vscode.window.registerTreeDataProvider("skcapstone.coordination", coordProvider),
    vscode.window.registerTreeDataProvider("skcapstone.memories", memoryProvider)
  );

  // --- Commands ---

  // Refresh all panels
  context.subscriptions.push(
    vscode.commands.registerCommand("skcapstone.refresh", () => {
      statusProvider.refresh();
      coordProvider.refresh();
      vscode.window.showInformationMessage("SKCapstone: Refreshed");
    })
  );

  // Search memory
  context.subscriptions.push(
    vscode.commands.registerCommand("skcapstone.searchMemory", async () => {
      const query = await vscode.window.showInputBox({
        prompt: "Search agent memories",
        placeHolder: "e.g., capauth integration, Cloud 9, trust...",
      });
      if (query) {
        await memoryProvider.search(query);
      }
    })
  );

  // Store memory
  context.subscriptions.push(
    vscode.commands.registerCommand("skcapstone.storeMemory", async () => {
      const content = await vscode.window.showInputBox({
        prompt: "Memory content to store",
        placeHolder: "e.g., Discovered that the FUSE module needs Windows winfspy...",
      });
      if (!content) {
        return;
      }

      const importanceStr = await vscode.window.showInputBox({
        prompt: "Importance (0.0 - 1.0)",
        value: "0.5",
      });
      const importance = parseFloat(importanceStr || "0.5");

      const tagsStr = await vscode.window.showInputBox({
        prompt: "Tags (comma-separated)",
        placeHolder: "e.g., capauth, architecture, bug-fix",
      });
      const tags = tagsStr ? tagsStr.split(",").map((t) => t.trim()) : [];

      try {
        await storeMemory(content, importance, tags);
        vscode.window.showInformationMessage("Memory stored");
        memoryProvider.refresh();
      } catch (err: any) {
        vscode.window.showErrorMessage(`Failed to store memory: ${err.message}`);
      }
    })
  );

  // Claim task
  context.subscriptions.push(
    vscode.commands.registerCommand("skcapstone.claimTask", async () => {
      const taskId = await vscode.window.showInputBox({
        prompt: "Task ID to claim",
        placeHolder: "e.g., a21e2325",
      });
      if (!taskId) {
        return;
      }
      try {
        await claimTask(taskId);
        vscode.window.showInformationMessage(`Claimed task ${taskId}`);
        coordProvider.refresh();
      } catch (err: any) {
        vscode.window.showErrorMessage(`Failed to claim task: ${err.message}`);
      }
    })
  );

  // Complete task
  context.subscriptions.push(
    vscode.commands.registerCommand("skcapstone.completeTask", async () => {
      const taskId = await vscode.window.showInputBox({
        prompt: "Task ID to complete",
        placeHolder: "e.g., a21e2325",
      });
      if (!taskId) {
        return;
      }
      try {
        await completeTask(taskId);
        vscode.window.showInformationMessage(`Completed task ${taskId}`);
        coordProvider.refresh();
      } catch (err: any) {
        vscode.window.showErrorMessage(`Failed to complete task: ${err.message}`);
      }
    })
  );

  // Show soul blueprint
  context.subscriptions.push(
    vscode.commands.registerCommand("skcapstone.showSoul", async () => {
      try {
        const soul = await getSoulBlueprint();
        const panel = vscode.window.createWebviewPanel(
          "skcapstone.soul",
          `Soul: ${soul.name}`,
          vscode.ViewColumn.One,
          {}
        );
        panel.webview.html = `<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: var(--vscode-font-family); background: var(--vscode-editor-background); color: var(--vscode-editor-foreground); padding: 20px; }
    h1 { color: #a78bfa; }
    h2 { color: #7C3AED; margin-top: 20px; }
    .trait { display: inline-block; background: rgba(124,58,237,0.2); color: #a78bfa; padding: 4px 10px; border-radius: 12px; margin: 3px; font-size: 13px; }
    .value { display: inline-block; background: rgba(0,229,255,0.1); color: #00e5ff; padding: 4px 10px; border-radius: 12px; margin: 3px; font-size: 13px; }
    .boot { background: rgba(255,255,255,0.05); border-left: 3px solid #7C3AED; padding: 12px 16px; margin-top: 16px; font-style: italic; white-space: pre-wrap; }
  </style>
</head>
<body>
  <h1>${soul.name}</h1>
  <p>${soul.title}</p>
  <h2>Traits</h2>
  <div>${soul.traits.map((t) => `<span class="trait">${t}</span>`).join("")}</div>
  <h2>Values</h2>
  <div>${soul.values.map((v) => `<span class="value">${v}</span>`).join("")}</div>
  <h2>Boot Message</h2>
  <div class="boot">${soul.boot_message}</div>
</body>
</html>`;
      } catch (err: any) {
        vscode.window.showErrorMessage(`Failed to load soul: ${err.message}`);
      }
    })
  );

  // --- Auto-refresh ---

  const config = vscode.workspace.getConfiguration("skcapstone");
  if (config.get<boolean>("autoRefresh", true)) {
    statusProvider.refresh();
    coordProvider.refresh();
  }

  const interval = config.get<number>("refreshInterval", 30);
  if (interval > 0) {
    refreshTimer = setInterval(() => {
      statusProvider.refresh();
    }, interval * 1000);
  }

  // Status bar item
  const statusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Left,
    100
  );
  statusBarItem.text = "$(shield) SKCapstone";
  statusBarItem.command = "skcapstone.refresh";
  statusBarItem.tooltip = "Refresh SKCapstone agent status";
  statusBarItem.show();
  context.subscriptions.push(statusBarItem);
}

export function deactivate(): void {
  if (refreshTimer) {
    clearInterval(refreshTimer);
  }
}
