import type { Database } from "../../../infra/db/database";
import type { ExecutionProcessLogs } from "../../../models/execution-process";

export async function upsertLogs(
	db: Database,
	logs: ExecutionProcessLogs,
): Promise<void> {
	await db.queryRun({
		query: `INSERT INTO execution_process_logs (execution_process_id, logs)
         VALUES (?, ?)
         ON CONFLICT(execution_process_id) DO UPDATE SET
           logs = excluded.logs`,
		params: [logs.executionProcessId, logs.logs],
	});
}
