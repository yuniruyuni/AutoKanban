import type { Database } from "bun:sqlite";
import type { ExecutionProcessLogs } from "../../../models/execution-process";

export function upsertLogs(db: Database, logs: ExecutionProcessLogs): void {
	db.query(
		`INSERT INTO execution_process_logs (execution_process_id, logs)
         VALUES (?, ?)
         ON CONFLICT(execution_process_id) DO UPDATE SET
           logs = excluded.logs`,
	).run(logs.executionProcessId, logs.logs);
}
