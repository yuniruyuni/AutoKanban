import type { Database } from "../../../infra/db/database";
import { dateToSQL } from "../../../infra/db/sql-helpers";

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
