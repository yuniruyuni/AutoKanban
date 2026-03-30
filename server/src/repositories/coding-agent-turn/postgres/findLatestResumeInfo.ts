import type { Database } from "../../../lib/db/database";
import type { CodingAgentResumeInfo } from "../../../models/coding-agent-turn";

export async function findLatestResumeInfo(
	db: Database,
	sessionId: string,
): Promise<CodingAgentResumeInfo | null> {
	const row = await db.queryGet<{
		agent_session_id: string;
		agent_message_id: string | null;
	}>({
		query: `SELECT cat.agent_session_id, cat.agent_message_id
       FROM coding_agent_turns cat
       JOIN execution_processes ep ON ep.id = cat.execution_process_id
       WHERE ep.session_id = ?
         AND cat.agent_session_id IS NOT NULL
       ORDER BY cat.created_at DESC
       LIMIT 1`,
		params: [sessionId],
	});

	if (!row) {
		return null;
	}

	return {
		agentSessionId: row.agent_session_id,
		agentMessageId: row.agent_message_id,
	};
}
