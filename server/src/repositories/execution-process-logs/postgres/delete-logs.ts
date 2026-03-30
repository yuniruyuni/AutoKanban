import type { PgDatabase } from "../../common";

export async function deleteLogs(
	db: PgDatabase,
	executionProcessId: string,
): Promise<void> {
	await db.queryRun({
		query: `DELETE FROM execution_process_logs WHERE execution_process_id = ?`,
		params: [executionProcessId],
	});
}
