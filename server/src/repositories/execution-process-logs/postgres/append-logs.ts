import type { PgDatabase } from "../../../db/pg-client";

export async function appendLogs(
	db: PgDatabase,
	executionProcessId: string,
	newLogs: string,
): Promise<void> {
	await db.queryRun({
		query: `INSERT INTO execution_process_logs (execution_process_id, logs)
         VALUES (?, ?)
         ON CONFLICT(execution_process_id) DO UPDATE SET
           logs = logs || excluded.logs`,
		params: [executionProcessId, newLogs],
	});
}
