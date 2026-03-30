import type { Database } from "../../../lib/db/database";

export async function deleteLogs(
	db: Database,
	executionProcessId: string,
): Promise<void> {
	await db.queryRun({
		query: `DELETE FROM execution_process_logs WHERE execution_process_id = ?`,
		params: [executionProcessId],
	});
}
