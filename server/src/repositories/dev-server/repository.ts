import type { ProcessType } from "../../infra/callback/client";
import type { ServiceCtx } from "../common";

/**
 * Long-running async script runner used both for the per-session dev server
 * (processType: "devserver") and for one-off workspace scripts like Prepare /
 * Cleanup (processType: "workspacescript"). The caller picks which logical
 * kind of process it is spawning — this drives both the persistent logs table
 * used by LogCollector and the processType value fed to the completion
 * callback so `completeExecutionProcess` updates the right entity.
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
		},
	): void;
	stop(ctx: ServiceCtx, processId: string): boolean;
	get(ctx: ServiceCtx, processId: string): { pid: number } | undefined;
}
