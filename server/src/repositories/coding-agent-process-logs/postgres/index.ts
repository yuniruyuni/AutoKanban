import type { CodingAgentProcessLogs } from "../../../models/coding-agent-process";
import type { DbReadCtx, DbWriteCtx } from "../../common";
import type { CodingAgentProcessLogsRepository as ICodingAgentProcessLogsRepository } from "../repository";

export class CodingAgentProcessLogsRepository
	implements ICodingAgentProcessLogsRepository
{
	async getLogs(
		ctx: DbReadCtx,
		codingAgentProcessId: string,
	): Promise<CodingAgentProcessLogs | null> {
		const row = await ctx.db.queryGet<{
			coding_agent_process_id: string;
			logs: string;
		}>({
			query: `SELECT * FROM coding_agent_process_logs WHERE coding_agent_process_id = ?`,
			params: [codingAgentProcessId],
		});
		return row
			? {
					codingAgentProcessId: row.coding_agent_process_id,
					logs: row.logs,
				}
			: null;
	}

	async upsertLogs(
		ctx: DbWriteCtx,
		logs: CodingAgentProcessLogs,
	): Promise<void> {
		await ctx.db.queryRun({
			query: `INSERT INTO coding_agent_process_logs (coding_agent_process_id, logs)
         VALUES (?, ?)
         ON CONFLICT(coding_agent_process_id) DO UPDATE SET
           logs = excluded.logs`,
			params: [logs.codingAgentProcessId, logs.logs],
		});
	}

	async appendLogs(
		ctx: DbWriteCtx,
		codingAgentProcessId: string,
		newLogs: string,
	): Promise<void> {
		await ctx.db.queryRun({
			query: `INSERT INTO coding_agent_process_logs (coding_agent_process_id, logs)
         VALUES (?, ?)
         ON CONFLICT(coding_agent_process_id) DO UPDATE SET
           logs = coding_agent_process_logs.logs || excluded.logs`,
			params: [codingAgentProcessId, newLogs],
		});
	}

	async deleteLogs(
		ctx: DbWriteCtx,
		codingAgentProcessId: string,
	): Promise<void> {
		await ctx.db.queryRun({
			query: `DELETE FROM coding_agent_process_logs WHERE coding_agent_process_id = ?`,
			params: [codingAgentProcessId],
		});
	}
}
