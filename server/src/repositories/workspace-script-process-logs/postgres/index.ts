import type { WorkspaceScriptProcessLogs } from "../../../models/workspace-script-process";
import type { DbReadCtx, DbWriteCtx } from "../../common";
import type { WorkspaceScriptProcessLogsRepository as IWorkspaceScriptProcessLogsRepository } from "../repository";

export class WorkspaceScriptProcessLogsRepository
	implements IWorkspaceScriptProcessLogsRepository
{
	async getLogs(
		ctx: DbReadCtx,
		workspaceScriptProcessId: string,
	): Promise<WorkspaceScriptProcessLogs | null> {
		const row = await ctx.db.queryGet<{
			workspace_script_process_id: string;
			logs: string;
		}>({
			query: `SELECT * FROM workspace_script_process_logs WHERE workspace_script_process_id = ?`,
			params: [workspaceScriptProcessId],
		});
		return row
			? {
					workspaceScriptProcessId: row.workspace_script_process_id,
					logs: row.logs,
				}
			: null;
	}

	async upsertLogs(
		ctx: DbWriteCtx,
		logs: WorkspaceScriptProcessLogs,
	): Promise<void> {
		await ctx.db.queryRun({
			query: `INSERT INTO workspace_script_process_logs (workspace_script_process_id, logs)
         VALUES (?, ?)
         ON CONFLICT(workspace_script_process_id) DO UPDATE SET
           logs = excluded.logs`,
			params: [logs.workspaceScriptProcessId, logs.logs],
		});
	}

	async appendLogs(
		ctx: DbWriteCtx,
		workspaceScriptProcessId: string,
		newLogs: string,
	): Promise<void> {
		await ctx.db.queryRun({
			query: `INSERT INTO workspace_script_process_logs (workspace_script_process_id, logs)
         VALUES (?, ?)
         ON CONFLICT(workspace_script_process_id) DO UPDATE SET
           logs = workspace_script_process_logs.logs || excluded.logs`,
			params: [workspaceScriptProcessId, newLogs],
		});
	}

	async deleteLogs(
		ctx: DbWriteCtx,
		workspaceScriptProcessId: string,
	): Promise<void> {
		await ctx.db.queryRun({
			query: `DELETE FROM workspace_script_process_logs WHERE workspace_script_process_id = ?`,
			params: [workspaceScriptProcessId],
		});
	}
}
