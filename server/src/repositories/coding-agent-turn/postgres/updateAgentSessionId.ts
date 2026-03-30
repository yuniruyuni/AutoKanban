import type { Database } from "../../common";
import { dateToSQL } from "../../common";

export async function updateAgentSessionId(
	db: Database,
	executionProcessId: string,
	agentSessionId: string,
): Promise<void> {
	await db.queryRun({
		query: `UPDATE coding_agent_turns
     SET agent_session_id = ?, updated_at = ?
     WHERE execution_process_id = ?`,
		params: [agentSessionId, dateToSQL(new Date()), executionProcessId],
	});
}
