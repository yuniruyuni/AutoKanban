import type { PgDatabase } from "../../../db/pg-client";
import { dateToSQL } from "../../common";

export async function updateSummary(
	db: PgDatabase,
	executionProcessId: string,
	summary: string,
): Promise<void> {
	await db.queryRun({
		query: `UPDATE coding_agent_turns
     SET summary = ?, updated_at = ?
     WHERE execution_process_id = ?`,
		params: [summary, dateToSQL(new Date()), executionProcessId],
	});
}
