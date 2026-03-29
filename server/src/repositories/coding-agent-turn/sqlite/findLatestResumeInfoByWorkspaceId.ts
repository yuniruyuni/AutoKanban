import type { Database } from "bun:sqlite";
import type { CodingAgentResumeInfo } from "../../../models/coding-agent-turn";

export function findLatestResumeInfoByWorkspaceId(
	db: Database,
	workspaceId: string,
): CodingAgentResumeInfo | null {
	const row = db
		.query<
			{ agent_session_id: string; agent_message_id: string | null },
			[string]
		>(
			`SELECT cat.agent_session_id, cat.agent_message_id
       FROM coding_agent_turns cat
       JOIN execution_processes ep ON ep.id = cat.execution_process_id
       JOIN sessions s ON s.id = ep.session_id
       WHERE s.workspace_id = ?
         AND cat.agent_session_id IS NOT NULL
       ORDER BY cat.created_at DESC
       LIMIT 1`,
		)
		.get(workspaceId);

	if (!row) {
		return null;
	}

	return {
		agentSessionId: row.agent_session_id,
		agentMessageId: row.agent_message_id,
	};
}
