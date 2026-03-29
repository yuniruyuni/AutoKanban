import type { CodingAgentTurn } from "../../../models/coding-agent-turn";
import { dateFromSQL } from "../../common";
import { type SQLFragment, sql } from "../../sql";

export interface CodingAgentTurnRow {
	id: string;
	execution_process_id: string;
	agent_session_id: string | null;
	agent_message_id: string | null;
	prompt: string | null;
	summary: string | null;
	seen: number;
	created_at: string;
	updated_at: string;
}

type CodingAgentTurnSpecData =
	| { type: "ById"; id: string }
	| { type: "ByExecutionProcessId"; executionProcessId: string }
	| { type: "ByAgentSessionId"; agentSessionId: string }
	| { type: "HasAgentSessionId" };

export function codingAgentTurnSpecToSQL(
	spec: CodingAgentTurnSpecData,
): SQLFragment {
	switch (spec.type) {
		case "ById":
			return sql`id = ${spec.id}`;
		case "ByExecutionProcessId":
			return sql`execution_process_id = ${spec.executionProcessId}`;
		case "ByAgentSessionId":
			return sql`agent_session_id = ${spec.agentSessionId}`;
		case "HasAgentSessionId":
			return sql`agent_session_id IS NOT NULL`;
	}
}

export function rowToCodingAgentTurn(row: CodingAgentTurnRow): CodingAgentTurn {
	return {
		id: row.id,
		executionProcessId: row.execution_process_id,
		agentSessionId: row.agent_session_id,
		agentMessageId: row.agent_message_id,
		prompt: row.prompt,
		summary: row.summary,
		seen: row.seen === 1,
		createdAt: dateFromSQL(row.created_at),
		updatedAt: dateFromSQL(row.updated_at),
	};
}

export function columnName(key: CodingAgentTurn.SortKey): string {
	const map: Record<CodingAgentTurn.SortKey, string> = {
		createdAt: "created_at",
		id: "id",
	};
	return map[key];
}
