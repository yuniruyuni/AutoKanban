import type { Database } from "bun:sqlite";

export function appendLogs(
	db: Database,
	executionProcessId: string,
	newLogs: string,
): void {
	db.query(
		`INSERT INTO execution_process_logs (execution_process_id, logs)
         VALUES (?, ?)
         ON CONFLICT(execution_process_id) DO UPDATE SET
           logs = logs || excluded.logs`,
	).run(executionProcessId, newLogs);
}
