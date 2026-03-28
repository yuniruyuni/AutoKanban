import type { Database, SQLQueryBindings } from "bun:sqlite";
import type { Cursor, Page } from "../models/common";
import { Session } from "../models/session";
import type { ISessionRepository } from "../types/repository";
import { compToSQL, dateFromSQL, dateToSQL } from "./common";
import { type SQLFragment, sql } from "./sql";

// ============================================
// Row type
// ============================================

interface SessionRow {
	id: string;
	workspace_id: string;
	executor: string | null;
	variant: string | null;
	created_at: string;
	updated_at: string;
}

// ============================================
// Spec to SQL converter
// ============================================

type SessionSpecData =
	| { type: "ById"; id: string }
	| { type: "ByWorkspaceId"; workspaceId: string };

function sessionSpecToSQL(spec: SessionSpecData): SQLFragment {
	switch (spec.type) {
		case "ById":
			return sql`id = ${spec.id}`;
		case "ByWorkspaceId":
			return sql`workspace_id = ${spec.workspaceId}`;
	}
}

// ============================================
// Row to Entity converter
// ============================================

function rowToSession(row: SessionRow): Session {
	return {
		id: row.id,
		workspaceId: row.workspace_id,
		executor: row.executor,
		variant: row.variant,
		createdAt: dateFromSQL(row.created_at),
		updatedAt: dateFromSQL(row.updated_at),
	};
}

// ============================================
// Session Repository
// ============================================

export class SessionRepository implements ISessionRepository {
	constructor(private db: Database) {}

	get(spec: Session.Spec): Session | null {
		const where = compToSQL(
			spec,
			sessionSpecToSQL as (s: unknown) => SQLFragment,
		);
		const row = this.db
			.query<SessionRow, SQLQueryBindings[]>(
				`SELECT * FROM sessions WHERE ${where.query} LIMIT 1`,
			)
			.get(...(where.params as SQLQueryBindings[]));

		return row ? rowToSession(row) : null;
	}

	list(spec: Session.Spec, cursor: Cursor<Session.SortKey>): Page<Session> {
		const where = compToSQL(
			spec,
			sessionSpecToSQL as (s: unknown) => SQLFragment,
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
			.query<SessionRow, SQLQueryBindings[]>(
				`SELECT * FROM sessions WHERE ${where.query} ORDER BY ${orderBy} LIMIT ${limit}`,
			)
			.all(...(where.params as SQLQueryBindings[]));

		const hasMore = rows.length > cursor.limit;
		const items = rows.slice(0, cursor.limit).map(rowToSession);

		const lastItem = items[items.length - 1];
		const nextCursor =
			hasMore && lastItem ? Session.cursor(lastItem, sort.keys) : undefined;

		return { items, hasMore, nextCursor };
	}

	upsert(session: Session): void {
		this.db
			.query(
				`INSERT INTO sessions (id, workspace_id, executor, variant, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           executor = excluded.executor,
           variant = excluded.variant,
           updated_at = excluded.updated_at`,
			)
			.run(
				session.id,
				session.workspaceId,
				session.executor,
				session.variant,
				dateToSQL(session.createdAt),
				dateToSQL(session.updatedAt),
			);
	}

	delete(spec: Session.Spec): number {
		const where = compToSQL(
			spec,
			sessionSpecToSQL as (s: unknown) => SQLFragment,
		);
		const result = this.db
			.query<{ changes: number }, SQLQueryBindings[]>(
				`DELETE FROM sessions WHERE ${where.query}`,
			)
			.run(...(where.params as SQLQueryBindings[]));

		return result.changes;
	}

	private columnName(key: Session.SortKey): string {
		const map: Record<Session.SortKey, string> = {
			createdAt: "created_at",
			updatedAt: "updated_at",
			id: "id",
		};
		return map[key];
	}
}
