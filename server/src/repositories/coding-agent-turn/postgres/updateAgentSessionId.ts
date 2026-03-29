import type { PgDatabase } from "../../../db/pg-client";
import { dateToSQL } from "../../common";

export async function updateAgentSessionId(
	db: PgDatabase,
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
