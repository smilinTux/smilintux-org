/**
 * CLI bridge — executes skcapstone commands and parses JSON output.
 *
 * All agent operations go through the skcapstone CLI rather than
 * importing Python modules. This keeps the extension lightweight
 * and works regardless of Python environment configuration.
 */
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
/**
 * Run a skcapstone CLI command and return parsed JSON output.
 */
export declare function runCommand(args: string[]): Promise<any>;
/**
 * Get agent status (identity, pillars, consciousness).
 */
export declare function getStatus(): Promise<AgentStatus>;
/**
 * Get coordination board tasks.
 */
export declare function getCoordTasks(): Promise<CoordTask[]>;
/**
 * Search agent memories.
 */
export declare function searchMemories(query: string): Promise<Memory[]>;
/**
 * Store a new memory.
 */
export declare function storeMemory(content: string, importance?: number, tags?: string[]): Promise<void>;
/**
 * Claim a coordination task.
 */
export declare function claimTask(taskId: string): Promise<void>;
/**
 * Complete a coordination task.
 */
export declare function completeTask(taskId: string): Promise<void>;
/**
 * Get the soul blueprint.
 */
export declare function getSoulBlueprint(): Promise<SoulBlueprint>;
//# sourceMappingURL=cli.d.ts.map