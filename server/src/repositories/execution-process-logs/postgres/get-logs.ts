import type { Database } from "../../../lib/db/database";
import type { ExecutionProcessLogs } from "../../../models/execution-process";
import type { ExecutionProcessLogsRow } from "./common";

export async function getLogs(
	db: Database,
	executionProcessId: string,
): Promise<ExecutionProcessLogs | null> {
	const row = await db.queryGet<ExecutionProcessLogsRow>({
		query: `SELECT * FROM execution_process_logs WHERE execution_process_id = ?`,
		params: [executionProcessId],
	});

	return row
		? { executionProcessId: row.execution_process_id, logs: row.logs }
		: null;
}
