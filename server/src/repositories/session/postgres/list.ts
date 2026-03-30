import type { PgDatabase } from "../../../db/pg-client";
import type { Cursor, Page } from "../../../models/common";
import { Session } from "../../../models/session";
import { compToSQL } from "../../common";
import type { SQLFragment } from "../../common";
import {
	columnName,
	rowToSession,
	type SessionRow,
	sessionSpecToSQL,
} from "./common";

export async function list(
	db: PgDatabase,
	spec: Session.Spec,
	cursor: Cursor<Session.SortKey>,
): Promise<Page<Session>> {
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

	const rows = await db.queryAll<SessionRow>({
		query: `SELECT * FROM sessions WHERE ${where.query} ORDER BY ${orderBy} LIMIT ${limit}`,
		params: where.params,
	});

	const hasMore = rows.length > cursor.limit;
	const items = rows.slice(0, cursor.limit).map(rowToSession);

	const lastItem = items[items.length - 1];
	const nextCursor =
		hasMore && lastItem ? Session.cursor(lastItem, sort.keys) : undefined;

	return { items, hasMore, nextCursor };
}
