import type { Database } from "../../common";

export async function appendLogs(
	db: Database,
	executionProcessId: string,
	newLogs: string,
): Promise<void> {
	await db.queryRun({
		query: `INSERT INTO execution_process_logs (execution_process_id, logs)
         VALUES (?, ?)
         ON CONFLICT(execution_process_id) DO UPDATE SET
           logs = execution_process_logs.logs || excluded.logs`,
		params: [executionProcessId, newLogs],
	});
}
