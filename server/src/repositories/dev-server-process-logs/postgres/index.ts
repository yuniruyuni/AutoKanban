import type { DevServerProcessLogs } from "../../../models/dev-server-process";
import type { DbReadCtx, DbWriteCtx } from "../../common";
import type { DevServerProcessLogsRepository as IDevServerProcessLogsRepository } from "../repository";

export class DevServerProcessLogsRepository
	implements IDevServerProcessLogsRepository
{
	async getLogs(
		ctx: DbReadCtx,
		devServerProcessId: string,
	): Promise<DevServerProcessLogs | null> {
		const row = await ctx.db.queryGet<{
			dev_server_process_id: string;
			logs: string;
		}>({
			query: `SELECT * FROM dev_server_process_logs WHERE dev_server_process_id = ?`,
			params: [devServerProcessId],
		});
		return row
			? { devServerProcessId: row.dev_server_process_id, logs: row.logs }
			: null;
	}

	async upsertLogs(ctx: DbWriteCtx, logs: DevServerProcessLogs): Promise<void> {
		await ctx.db.queryRun({
			query: `INSERT INTO dev_server_process_logs (dev_server_process_id, logs)
         VALUES (?, ?)
         ON CONFLICT(dev_server_process_id) DO UPDATE SET
           logs = excluded.logs`,
			params: [logs.devServerProcessId, logs.logs],
		});
	}

	async appendLogs(
		ctx: DbWriteCtx,
		devServerProcessId: string,
		newLogs: string,
	): Promise<void> {
		await ctx.db.queryRun({
			query: `INSERT INTO dev_server_process_logs (dev_server_process_id, logs)
         VALUES (?, ?)
         ON CONFLICT(dev_server_process_id) DO UPDATE SET
           logs = dev_server_process_logs.logs || excluded.logs`,
			params: [devServerProcessId, newLogs],
		});
	}

	async deleteLogs(ctx: DbWriteCtx, devServerProcessId: string): Promise<void> {
		await ctx.db.queryRun({
			query: `DELETE FROM dev_server_process_logs WHERE dev_server_process_id = ?`,
			params: [devServerProcessId],
		});
	}
}
