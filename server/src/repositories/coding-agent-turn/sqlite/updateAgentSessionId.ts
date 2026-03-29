import type { Database } from "bun:sqlite";
import { dateToSQL } from "../../common";

export function updateAgentSessionId(
	db: Database,
	executionProcessId: string,
	agentSessionId: string,
): void {
	db.query(
		`UPDATE coding_agent_turns
     SET agent_session_id = ?, updated_at = ?
     WHERE execution_process_id = ?`,
	).run(agentSessionId, dateToSQL(new Date()), executionProcessId);
}
