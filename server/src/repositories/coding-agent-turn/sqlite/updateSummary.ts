import type { Database } from "bun:sqlite";
import { dateToSQL } from "../../common";

export function updateSummary(
	db: Database,
	executionProcessId: string,
	summary: string,
): void {
	db.query(
		`UPDATE coding_agent_turns
     SET summary = ?, updated_at = ?
     WHERE execution_process_id = ?`,
	).run(summary, dateToSQL(new Date()), executionProcessId);
}
