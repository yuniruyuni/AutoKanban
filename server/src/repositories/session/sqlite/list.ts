import type { Database, SQLQueryBindings } from "bun:sqlite";
import type { Cursor, Page } from "../../../models/common";
import { Session } from "../../../models/session";
import { compToSQL } from "../../common";
import type { SQLFragment } from "../../sql";
import {
	type SessionRow,
	columnName,
	rowToSession,
	sessionSpecToSQL,
} from "./common";

export function list(
	db: Database,
	spec: Session.Spec,
	cursor: Cursor<Session.SortKey>,
): Page<Session> {
	const where = compToSQL(
		spec,
		sessionSpecToSQL as (s: unknown) => SQLFragment,
	);

	const sort = cursor.sort ?? {
		keys: ["createdAt", "id"] as const,
		order: "desc" as const,
	};
	const orderBy = sort.keys
		.map((k) => `${columnName(k)} ${sort.order.toUpperCase()}`)
		.join(", ");

	const limit = cursor.limit + 1;

	const rows = db
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
