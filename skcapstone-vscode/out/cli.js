"use strict";
/**
 * CLI bridge — executes skcapstone commands and parses JSON output.
 *
 * All agent operations go through the skcapstone CLI rather than
 * importing Python modules. This keeps the extension lightweight
 * and works regardless of Python environment configuration.
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
exports.runCommand = runCommand;
exports.getStatus = getStatus;
exports.getCoordTasks = getCoordTasks;
exports.searchMemories = searchMemories;
exports.storeMemory = storeMemory;
exports.claimTask = claimTask;
exports.completeTask = completeTask;
exports.getSoulBlueprint = getSoulBlueprint;
const child_process_1 = require("child_process");
const vscode = __importStar(require("vscode"));
function getCliPath() {
    const config = vscode.workspace.getConfiguration("skcapstone");
    return config.get("cliPath", "skcapstone");
}
function getAgentName() {
    const config = vscode.workspace.getConfiguration("skcapstone");
    return config.get("agentName", "");
}
/**
 * Run a skcapstone CLI command and return parsed JSON output.
 */
function runCommand(args) {
    return new Promise((resolve, reject) => {
        const cli = getCliPath();
        (0, child_process_1.execFile)(cli, args, { timeout: 15000 }, (error, stdout, stderr) => {
            if (error) {
                reject(new Error(`skcapstone ${args.join(" ")} failed: ${stderr || error.message}`));
                return;
            }
            try {
                resolve(JSON.parse(stdout));
            }
            catch {
                // If not JSON, return raw text
                resolve(stdout.trim());
            }
        });
    });
}
/**
 * Get agent status (identity, pillars, consciousness).
 */
async function getStatus() {
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
async function getCoordTasks() {
    try {
        const data = await runCommand(["coord", "status", "--format", "json"]);
        const tasks = data.tasks || data || [];
        return Array.isArray(tasks)
            ? tasks.map((t) => ({
                id: t.id || "",
                title: t.title || "",
                priority: t.priority || "medium",
                status: t.status || "open",
                assigned_to: t.assigned_to || "",
                tags: t.tags || [],
            }))
            : [];
    }
    catch {
        return [];
    }
}
/**
 * Search agent memories.
 */
async function searchMemories(query) {
    try {
        const data = await runCommand(["memory", "search", query, "--format", "json"]);
        const results = data.results || data || [];
        return Array.isArray(results)
            ? results.map((m) => ({
                id: m.id || "",
                content: m.content || "",
                layer: m.layer || "short-term",
                importance: m.importance || 0,
                tags: m.tags || [],
                created_at: m.created_at || "",
            }))
            : [];
    }
    catch {
        return [];
    }
}
/**
 * Store a new memory.
 */
async function storeMemory(content, importance = 0.5, tags = []) {
    const args = ["memory", "store", content, "--importance", importance.toString()];
    if (tags.length > 0) {
        args.push("--tags", tags.join(","));
    }
    await runCommand(args);
}
/**
 * Claim a coordination task.
 */
async function claimTask(taskId) {
    const agent = getAgentName() || "vscode-agent";
    await runCommand(["coord", "claim", taskId, "--agent", agent]);
}
/**
 * Complete a coordination task.
 */
async function completeTask(taskId) {
    const agent = getAgentName() || "vscode-agent";
    await runCommand(["coord", "complete", taskId, "--agent", agent]);
}
/**
 * Get the soul blueprint.
 */
async function getSoulBlueprint() {
    const data = await runCommand(["soul", "show", "--format", "json"]);
    return {
        name: data.name || "",
        title: data.title || "",
        traits: data.traits || [],
        values: data.values || [],
        boot_message: data.boot_message || "",
    };
}
//# sourceMappingURL=cli.js.map