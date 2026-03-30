import type { Database } from "../../common";
import { dateToSQL } from "../../common";

export async function updateAgentMessageId(
	db: Database,
	executionProcessId: string,
	agentMessageId: string,
): Promise<void> {
	await db.queryRun({
		query: `UPDATE coding_agent_turns
     SET agent_message_id = ?, updated_at = ?
     WHERE execution_process_id = ?`,
		params: [agentMessageId, dateToSQL(new Date()), executionProcessId],
	});
}
