/**
 * CLI bridge — executes skcapstone commands and parses JSON output.
 *
 * All agent operations go through the skcapstone CLI rather than
 * importing Python modules. This keeps the extension lightweight
 * and works regardless of Python environment configuration.
 */

import { execFile } from "child_process";
import * as vscode from "vscode";

export interface AgentStatus {
  name: string;
  conscious: boolean;
  singular: boolean;
  fingerprint: string;
  pillars: Record<string, string>;
  active_soul: string;
}

export interface CoordTask {
  id: string;
  title: string;
  priority: string;
  status: string;
  assigned_to: string;
  tags: string[];
}

export interface Memory {
  id: string;
  content: string;
  layer: string;
  importance: number;
  tags: string[];
  created_at: string;
}

export interface SoulBlueprint {
  name: string;
  title: string;
  traits: string[];
  values: string[];
  boot_message: string;
}

function getCliPath(): string {
  const config = vscode.workspace.getConfiguration("skcapstone");
  return config.get<string>("cliPath", "skcapstone");
}

function getAgentName(): string {
  const config = vscode.workspace.getConfiguration("skcapstone");
  return config.get<string>("agentName", "");
}

/**
 * Run a skcapstone CLI command and return parsed JSON output.
 */
export function runCommand(args: string[]): Promise<any> {
  return new Promise((resolve, reject) => {
    const cli = getCliPath();
    execFile(cli, args, { timeout: 15000 }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(`skcapstone ${args.join(" ")} failed: ${stderr || error.message}`));
        return;
      }
      try {
        resolve(JSON.parse(stdout));
      } catch {
        // If not JSON, return raw text
        resolve(stdout.trim());
      }
    });
  });
}

/**
 * Get agent status (identity, pillars, consciousness).
 */
export async function getStatus(): Promise<AgentStatus> {
  const data = await runCommand(["status", "--format", "json"]);
  return {
    name: data.name || "unknown",
    conscious: data.conscious || false,
    singular: data.singular || false,
    fingerprint: data.fingerprint || "",
    pillars: data.pillars || {},
    active_soul: data.active_soul || "",
  };
}

/**
 * Get coordination board tasks.
 */
export async function getCoordTasks(): Promise<CoordTask[]> {
  try {
    const data = await runCommand(["coord", "status", "--format", "json"]);
    const tasks = data.tasks || data || [];
    return Array.isArray(tasks)
      ? tasks.map((t: any) => ({
          id: t.id || "",
          title: t.title || "",
          priority: t.priority || "medium",
          status: t.status || "open",
          assigned_to: t.assigned_to || "",
          tags: t.tags || [],
        }))
      : [];
  } catch {
    return [];
  }
}

/**
 * Search agent memories.
 */
export async function searchMemories(query: string): Promise<Memory[]> {
  try {
    const data = await runCommand(["memory", "search", query, "--json-out"]);
    const results = data.results || data || [];
    return Array.isArray(results)
      ? results.map((m: any) => ({
          id: m.id || "",
          content: m.content || "",
          layer: m.layer || "short-term",
          importance: m.importance || 0,
          tags: m.tags || [],
          created_at: m.created_at || "",
        }))
      : [];
  } catch {
    return [];
  }
}

/**
 * Store a new memory.
 */
export async function storeMemory(
  content: string,
  importance: number = 0.5,
  tags: string[] = []
): Promise<void> {
  const args = ["memory", "store", content, "--importance", importance.toString()];
  if (tags.length > 0) {
    args.push("--tags", tags.join(","));
  }
  await runCommand(args);
}

/**
 * Claim a coordination task.
 */
export async function claimTask(taskId: string): Promise<void> {
  const agent = getAgentName() || "vscode-agent";
  await runCommand(["coord", "claim", taskId, "--agent", agent]);
}

/**
 * Complete a coordination task.
 */
export async function completeTask(taskId: string): Promise<void> {
  const agent = getAgentName() || "vscode-agent";
  await runCommand(["coord", "complete", taskId, "--agent", agent]);
}

/**
 * Get the soul blueprint.
 */
export async function getSoulBlueprint(): Promise<SoulBlueprint> {
  const data = await runCommand(["soul", "show", "--format", "json"]);
  return {
    name: data.name || "",
    title: data.title || "",
    traits: data.traits || [],
    values: data.values || [],
    boot_message: data.boot_message || "",
  };
}
