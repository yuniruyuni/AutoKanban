import type { Database } from "bun:sqlite";
import { dateToSQL } from "../../common";

export function updateAgentMessageId(
	db: Database,
	executionProcessId: string,
	agentMessageId: string,
): void {
	db.query(
		`UPDATE coding_agent_turns
     SET agent_message_id = ?, updated_at = ?
     WHERE execution_process_id = ?`,
	).run(agentMessageId, dateToSQL(new Date()), executionProcessId);
}
