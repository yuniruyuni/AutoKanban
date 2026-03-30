import { type SQLFragment, sql } from "../../../lib/db/sql";
import { dateFromSQL } from "../../../lib/db/sql-helpers";
import type { Session } from "../../../models/session";

export interface SessionRow {
	id: string;
	workspace_id: string;
	executor: string | null;
	variant: string | null;
	created_at: Date;
	updated_at: Date;
}

type SessionSpecData =
	| { type: "ById"; id: string }
	| { type: "ByWorkspaceId"; workspaceId: string };

export function sessionSpecToSQL(spec: SessionSpecData): SQLFragment {
	switch (spec.type) {
		case "ById":
			return sql`id = ${spec.id}`;
		case "ByWorkspaceId":
			return sql`workspace_id = ${spec.workspaceId}`;
	}
}

export function rowToSession(row: SessionRow): Session {
	return {
		id: row.id,
		workspaceId: row.workspace_id,
		executor: row.executor,
		variant: row.variant,
		createdAt: dateFromSQL(row.created_at),
		updatedAt: dateFromSQL(row.updated_at),
	};
}

export function columnName(key: Session.SortKey): string {
	const map: Record<Session.SortKey, string> = {
		createdAt: "created_at",
		updatedAt: "updated_at",
		id: "id",
	};
	return map[key];
}
