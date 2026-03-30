import type { PgDatabase } from "../../common";
import type { CodingAgentTurn } from "../../../models/coding-agent-turn";
import { dateToSQL } from "../../common";

export async function upsert(
	db: PgDatabase,
	turn: CodingAgentTurn,
): Promise<void> {
	await db.queryRun({
		query: `INSERT INTO coding_agent_turns (id, execution_process_id, agent_session_id, agent_message_id, prompt, summary, seen, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       agent_session_id = excluded.agent_session_id,
       agent_message_id = excluded.agent_message_id,
       prompt = excluded.prompt,
       summary = excluded.summary,
       seen = excluded.seen,
       updated_at = excluded.updated_at`,
		params: [
			turn.id,
			turn.executionProcessId,
			turn.agentSessionId,
			turn.agentMessageId,
			turn.prompt,
			turn.summary,
			turn.seen,
			dateToSQL(turn.createdAt),
			dateToSQL(turn.updatedAt),
		],
	});
}
