import type { Database } from "bun:sqlite";

export function deleteLogs(db: Database, executionProcessId: string): void {
	db.query(
		`DELETE FROM execution_process_logs WHERE execution_process_id = ?`,
	).run(executionProcessId);
}
