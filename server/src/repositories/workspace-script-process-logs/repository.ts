import type { WorkspaceScriptProcessLogs } from "../../models/workspace-script-process";
import type { DbReadCtx, DbWriteCtx } from "../common";

export interface WorkspaceScriptProcessLogsRepository {
	getLogs(
		ctx: DbReadCtx,
		workspaceScriptProcessId: string,
	): Promise<WorkspaceScriptProcessLogs | null>;
	upsertLogs(ctx: DbWriteCtx, logs: WorkspaceScriptProcessLogs): Promise<void>;
	appendLogs(
		ctx: DbWriteCtx,
		workspaceScriptProcessId: string,
		newLogs: string,
	): Promise<void>;
	deleteLogs(ctx: DbWriteCtx, workspaceScriptProcessId: string): Promise<void>;
}
