import type { ProcessType } from "../../infra/callback/client";
import type { ServiceCtx } from "../common";

/**
 * Long-running async script runner used both for the per-session dev server
 * (processType: "devserver") and for one-off workspace scripts like Prepare /
 * Cleanup (processType: "workspacescript"). The caller picks which logical
 * kind of process it is spawning — this drives both the persistent logs table
 * used by LogCollector and the processType value fed to the completion
 * callback so `completeExecutionProcess` updates the right entity.
 *
 * The `context` object is exported to the child via `AK_*` env vars so
 * project scripts (`auto-kanban.json`) can isolate their side effects on a
 * per-process / per-workspace basis without AutoKanban knowing anything
 * project-specific.
 */
export interface DevServerRepository {
	start(
		ctx: ServiceCtx,
		options: {
			processId: string;
			sessionId: string;
			command: string;
			workingDir: string;
			processType: Extract<ProcessType, "devserver" | "workspacescript">;
			context: AkSpawnContext;
		},
	): void;
	stop(ctx: ServiceCtx, processId: string): boolean;
	get(ctx: ServiceCtx, processId: string): { pid: number } | undefined;
}

/**
 * Context surfaced to spawned scripts via `AK_*` env vars. AK_PROCESS_ID
 * and AK_SESSION_ID are already in `start()` options; the rest come from
 * the usecase's read/process step (task / project / workspace).
 */
export interface AkSpawnContext {
	taskId: string;
	workspaceId: string;
	projectId: string;
}
