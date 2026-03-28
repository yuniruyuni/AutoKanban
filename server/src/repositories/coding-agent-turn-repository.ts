import type { Database, SQLQueryBindings } from "bun:sqlite";
import {
	type CodingAgentResumeInfo,
	CodingAgentTurn,
} from "../models/coding-agent-turn";
import type { Cursor, Page } from "../models/common";
import type { ICodingAgentTurnRepository } from "../types/repository";
import { compToSQL, dateFromSQL, dateToSQL } from "./common";
import { type SQLFragment, sql } from "./sql";

// ============================================
// Row type
// ============================================

interface CodingAgentTurnRow {
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

// ============================================
// Spec to SQL converter
// ============================================

type CodingAgentTurnSpecData =
	| { type: "ById"; id: string }
	| { type: "ByExecutionProcessId"; executionProcessId: string }
	| { type: "ByAgentSessionId"; agentSessionId: string }
	| { type: "HasAgentSessionId" };

function codingAgentTurnSpecToSQL(spec: CodingAgentTurnSpecData): SQLFragment {
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

// ============================================
// Row to Entity converter
// ============================================

function rowToCodingAgentTurn(row: CodingAgentTurnRow): CodingAgentTurn {
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

// ============================================
// Coding Agent Turn Repository
// ============================================

export class CodingAgentTurnRepository implements ICodingAgentTurnRepository {
	constructor(private db: Database) {}

	get(spec: CodingAgentTurn.Spec): CodingAgentTurn | null {
		const where = compToSQL(
			spec,
			codingAgentTurnSpecToSQL as (s: unknown) => SQLFragment,
		);
		const row = this.db
			.query<CodingAgentTurnRow, SQLQueryBindings[]>(
				`SELECT * FROM coding_agent_turns WHERE ${where.query} LIMIT 1`,
			)
			.get(...(where.params as SQLQueryBindings[]));

		return row ? rowToCodingAgentTurn(row) : null;
	}

	list(
		spec: CodingAgentTurn.Spec,
		cursor: Cursor<CodingAgentTurn.SortKey>,
	): Page<CodingAgentTurn> {
		const where = compToSQL(
			spec,
			codingAgentTurnSpecToSQL as (s: unknown) => SQLFragment,
		);

		const sort = cursor.sort ?? {
			keys: ["createdAt", "id"] as const,
			order: "desc" as const,
		};
		const orderBy = sort.keys
			.map((k) => `${this.columnName(k)} ${sort.order.toUpperCase()}`)
			.join(", ");

		const limit = cursor.limit + 1;

		const rows = this.db
			.query<CodingAgentTurnRow, SQLQueryBindings[]>(
				`SELECT * FROM coding_agent_turns WHERE ${where.query} ORDER BY ${orderBy} LIMIT ${limit}`,
			)
			.all(...(where.params as SQLQueryBindings[]));

		const hasMore = rows.length > cursor.limit;
		const items = rows.slice(0, cursor.limit).map(rowToCodingAgentTurn);

		const lastItem = items[items.length - 1];
		const nextCursor =
			hasMore && lastItem
				? CodingAgentTurn.cursor(lastItem, sort.keys)
				: undefined;

		return { items, hasMore, nextCursor };
	}

	upsert(turn: CodingAgentTurn): void {
		this.db
			.query(
				`INSERT INTO coding_agent_turns (id, execution_process_id, agent_session_id, agent_message_id, prompt, summary, seen, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           agent_session_id = excluded.agent_session_id,
           agent_message_id = excluded.agent_message_id,
           prompt = excluded.prompt,
           summary = excluded.summary,
           seen = excluded.seen,
           updated_at = excluded.updated_at`,
			)
			.run(
				turn.id,
				turn.executionProcessId,
				turn.agentSessionId,
				turn.agentMessageId,
				turn.prompt,
				turn.summary,
				turn.seen ? 1 : 0,
				dateToSQL(turn.createdAt),
				dateToSQL(turn.updatedAt),
			);
	}

	delete(spec: CodingAgentTurn.Spec): number {
		const where = compToSQL(
			spec,
			codingAgentTurnSpecToSQL as (s: unknown) => SQLFragment,
		);
		const result = this.db
			.query<{ changes: number }, SQLQueryBindings[]>(
				`DELETE FROM coding_agent_turns WHERE ${where.query}`,
			)
			.run(...(where.params as SQLQueryBindings[]));

		return result.changes;
	}

	// ============================================
	// Agent Session Update Methods
	// ============================================

	updateAgentSessionId(
		executionProcessId: string,
		agentSessionId: string,
	): void {
		this.db
			.query(
				`UPDATE coding_agent_turns
         SET agent_session_id = ?, updated_at = ?
         WHERE execution_process_id = ?`,
			)
			.run(agentSessionId, dateToSQL(new Date()), executionProcessId);
	}

	updateAgentMessageId(
		executionProcessId: string,
		agentMessageId: string,
	): void {
		this.db
			.query(
				`UPDATE coding_agent_turns
         SET agent_message_id = ?, updated_at = ?
         WHERE execution_process_id = ?`,
			)
			.run(agentMessageId, dateToSQL(new Date()), executionProcessId);
	}

	updateSummary(executionProcessId: string, summary: string): void {
		this.db
			.query(
				`UPDATE coding_agent_turns
         SET summary = ?, updated_at = ?
         WHERE execution_process_id = ?`,
			)
			.run(summary, dateToSQL(new Date()), executionProcessId);
	}

	// ============================================
	// Resume Info Methods
	// ============================================

	/**
	 * Find the latest resume info for a session.
	 * Traverses: sessionId → execution_processes → coding_agent_turns
	 * Returns the most recent turn with an agent_session_id.
	 */
	findLatestResumeInfo(sessionId: string): CodingAgentResumeInfo | null {
		const row = this.db
			.query<
				{ agent_session_id: string; agent_message_id: string | null },
				[string]
			>(
				`SELECT cat.agent_session_id, cat.agent_message_id
         FROM coding_agent_turns cat
         JOIN execution_processes ep ON ep.id = cat.execution_process_id
         WHERE ep.session_id = ?
           AND cat.agent_session_id IS NOT NULL
         ORDER BY cat.created_at DESC
         LIMIT 1`,
			)
			.get(sessionId);

		if (!row) {
			return null;
		}

		return {
			agentSessionId: row.agent_session_id,
			agentMessageId: row.agent_message_id,
		};
	}

	/**
	 * Find the latest resume info for a workspace (across all sessions).
	 * Traverses: workspaceId → sessions → execution_processes → coding_agent_turns
	 * Returns the most recent turn with an agent_session_id.
	 * Used when restarting a task after server restart.
	 */
	findLatestResumeInfoByWorkspaceId(
		workspaceId: string,
	): CodingAgentResumeInfo | null {
		const row = this.db
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

	private columnName(key: CodingAgentTurn.SortKey): string {
		const map: Record<CodingAgentTurn.SortKey, string> = {
			createdAt: "created_at",
			id: "id",
		};
		return map[key];
	}
}
