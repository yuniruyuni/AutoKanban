import type { Database } from "bun:sqlite";
import type { ExecutionProcessLogs } from "../../../models/execution-process";
import type { ExecutionProcessLogsRow } from "./common";

export function getLogs(
	db: Database,
	executionProcessId: string,
): ExecutionProcessLogs | null {
	const row = db
		.query<ExecutionProcessLogsRow, [string]>(
			`SELECT * FROM execution_process_logs WHERE execution_process_id = ?`,
		)
		.get(executionProcessId);

	return row
		? { executionProcessId: row.execution_process_id, logs: row.logs }
		: null;
}
