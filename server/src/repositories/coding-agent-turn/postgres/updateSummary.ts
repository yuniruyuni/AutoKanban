import type { Database } from "../../../infra/db/database";
import { dateToSQL } from "../../../infra/db/sql-helpers";

export async function updateSummary(
	db: Database,
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
