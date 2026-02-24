/**
 * Bridge to the skcapstone CLI.
 *
 * Tool-agnostic: works in VSCode, Cursor, Windsurf, or any
 * VSCode-based editor. Calls `skcapstone` subcommands via
 * child_process and parses output.
 *
 * Python detection order:
 *   1. User setting `skcapstone.pythonPath`
 *   2. SKCAPSTONE_PYTHON env var
 *   3. Workspace venvs (skmemory/.venv, skcapstone/.venv, .venv)
 *   4. System `python3` / `python` on PATH
 */

import { execFile } from "child_process";
import { homedir } from "os";
import { existsSync } from "fs";
import { readFile } from "fs/promises";
import { join, delimiter } from "path";
import { platform } from "os";

const IS_WIN = platform() === "win32";
const PY_BIN_DIR = IS_WIN ? "Scripts" : "bin";
const PY_EXE = IS_WIN ? "python.exe" : "python";
const PATH_SEP = delimiter;

function defaultAgentHome(): string {
  return join(homedir(), ".skcapstone");
}

/** Result from a CLI invocation. */
export interface CliResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

/** Agent pillar status snapshot. */
export interface AgentStatus {
  name: string;
  version: string;
  isConscious: boolean;
  isSingular: boolean;
  pillars: Record<string, { status: string; [key: string]: unknown }>;
  connectors: string[];
}

/** A task on the coordination board. */
export interface CoordTask {
  id: string;
  title: string;
  priority: string;
  status: string;
  claimedBy: string | null;
  tags: string[];
  description: string;
}

/** An agent on the coordination board. */
export interface CoordAgent {
  name: string;
  state: string;
  currentTask: string | null;
}

/** Full board snapshot. */
export interface BoardStatus {
  tasks: CoordTask[];
  agents: CoordAgent[];
  summary: { total: number; open: number; claimed: number; inProgress: number; done: number };
}

/**
 * Read a VSCode configuration value, safely handling non-VSCode contexts.
 */
function getConfig<T>(key: string, fallback: T): T {
  try {
    const vscode = require("vscode");
    return vscode.workspace?.getConfiguration("skcapstone")?.get(key, fallback) ?? fallback;
  } catch {
    return fallback;
  }
}

/**
 * Resolve the agent home directory.
 *
 * Priority: user setting > environment variable > default.
 */
export function getAgentHome(): string {
  const fromConfig = getConfig<string>("agentHome", "");
  if (fromConfig) {
    return fromConfig;
  }
  return process.env.SKCAPSTONE_HOME ?? defaultAgentHome();
}

/**
 * Find the Python interpreter.
 *
 * Searches: user setting, env var, workspace venvs, system PATH.
 */
function findPython(): string {
  const fromConfig = getConfig<string>("pythonPath", "");
  if (fromConfig && existsSync(fromConfig)) {
    return fromConfig;
  }

  if (process.env.SKCAPSTONE_PYTHON && existsSync(process.env.SKCAPSTONE_PYTHON)) {
    return process.env.SKCAPSTONE_PYTHON;
  }

  const workspaceRoot = getWorkspaceRoot();
  if (workspaceRoot) {
    const candidates = [
      join(workspaceRoot, "skmemory", ".venv", PY_BIN_DIR, PY_EXE),
      join(workspaceRoot, "skcapstone", ".venv", PY_BIN_DIR, PY_EXE),
      join(workspaceRoot, ".venv", PY_BIN_DIR, PY_EXE),
    ];
    for (const p of candidates) {
      if (existsSync(p)) {
        return p;
      }
    }
  }

  return IS_WIN ? "python" : "python3";
}

function getWorkspaceRoot(): string | undefined {
  try {
    const vscode = require("vscode");
    const folders = vscode.workspace?.workspaceFolders;
    if (folders && folders.length > 0) {
      return folders[0].uri.fsPath;
    }
  } catch {
    // Not in a VSCode context (unit tests, etc.)
  }
  return undefined;
}

/**
 * Run a skcapstone CLI command.
 *
 * @param args - CLI arguments (e.g. ["coord", "status"]).
 * @param timeoutMs - Timeout in ms (default 15s).
 * @returns Parsed CliResult.
 */
export function runCli(args: string[], timeoutMs = 15_000): Promise<CliResult> {
  return new Promise((resolve) => {
    const python = findPython();
    const fullArgs = ["-m", "skcapstone.cli", ...args];

    const workspaceRoot = getWorkspaceRoot();
    const skcapstoneSrc = workspaceRoot
      ? join(workspaceRoot, "skcapstone", "src")
      : undefined;

    const env = { ...process.env };
    if (skcapstoneSrc && existsSync(skcapstoneSrc)) {
      env.PYTHONPATH = skcapstoneSrc + (env.PYTHONPATH ? PATH_SEP + env.PYTHONPATH : "");
    }

    const agentHome = getAgentHome();
    if (agentHome !== defaultAgentHome()) {
      env.SKCAPSTONE_HOME = agentHome;
    }

    execFile(
      python,
      fullArgs,
      { timeout: timeoutMs, env, maxBuffer: 1024 * 1024 },
      (error, stdout, stderr) => {
        resolve({
          stdout: stdout ?? "",
          stderr: stderr ?? "",
          exitCode: error ? ((error as any).code ?? 1) : 0,
        });
      }
    );
  });
}

/**
 * Check whether the agent home directory exists.
 */
export function isAgentInitialized(): boolean {
  const home = getAgentHome();
  return existsSync(home) && existsSync(join(home, "manifest.json"));
}

/**
 * Get agent status by reading the manifest from disk.
 */
export async function getAgentStatus(): Promise<AgentStatus | null> {
  if (!isAgentInitialized()) {
    return null;
  }
  const manifest = await readManifest();
  return {
    name: (manifest?.name as string) ?? "unknown",
    version: (manifest?.version as string) ?? "0.1.0",
    isConscious: false,
    isSingular: false,
    pillars: {},
    connectors: [],
  };
}

async function readManifest(): Promise<Record<string, unknown> | null> {
  const p = join(getAgentHome(), "manifest.json");
  try {
    const raw = await readFile(p, "utf-8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Get the coordination board status.
 */
export async function getCoordBoard(): Promise<BoardStatus> {
  const result = await runCli(["coord", "briefing", "--format", "json"]);

  const empty: BoardStatus = {
    tasks: [],
    agents: [],
    summary: { total: 0, open: 0, claimed: 0, inProgress: 0, done: 0 },
  };

  if (result.exitCode !== 0) {
    return empty;
  }

  try {
    const data = JSON.parse(result.stdout);
    const tasks: CoordTask[] = (data.tasks ?? []).map((t: any) => ({
      id: t.id,
      title: t.title,
      priority: t.priority,
      status: t.status,
      claimedBy: t.claimed_by ?? null,
      tags: t.tags ?? [],
      description: "",
    }));

    const agents: CoordAgent[] = (data.agents ?? []).map((a: any) => ({
      name: a.name,
      state: a.state,
      currentTask: a.current_task ?? null,
    }));

    const open = tasks.filter((t) => t.status === "open").length;
    const claimed = tasks.filter((t) => t.status === "claimed").length;
    const inProgress = tasks.filter((t) => t.status === "in_progress").length;
    const done = tasks.filter((t) => t.status === "done").length;

    return {
      tasks,
      agents,
      summary: { total: tasks.length, open, claimed, inProgress, done },
    };
  } catch {
    return empty;
  }
}

/**
 * Claim a task on the coordination board.
 */
export async function claimTask(taskId: string, agentName: string): Promise<boolean> {
  const result = await runCli(["coord", "claim", taskId, "--agent", agentName]);
  return result.exitCode === 0;
}

/**
 * Store a memory via the CLI.
 */
export async function storeMemory(
  content: string,
  tags: string[] = [],
  importance = 0.5
): Promise<boolean> {
  const args = ["memory", "store", content];
  for (const tag of tags) {
    args.push("-t", tag);
  }
  args.push("-i", importance.toString());
  const result = await runCli(args);
  return result.exitCode === 0;
}

/**
 * Search memories via the CLI.
 */
export async function searchMemory(query: string, limit = 10): Promise<string> {
  const result = await runCli(["memory", "search", query, "-n", limit.toString()]);
  return result.stdout || result.stderr;
}

/**
 * Push sync state via the CLI.
 */
export async function syncPush(): Promise<boolean> {
  const result = await runCli(["sync", "push"]);
  return result.exitCode === 0;
}
