import type { PgDatabase } from "../../../db/pg-client";
import type { Cursor, Page } from "../../../models/common";
import { Workspace } from "../../../models/workspace";
import { compToSQL } from "../../common";
import type { SQLFragment } from "../../sql";
import {
	columnName,
	rowToWorkspace,
	type WorkspaceRow,
	workspaceSpecToSQL,
} from "./common";

export async function list(
	db: PgDatabase,
	spec: Workspace.Spec,
	cursor: Cursor<Workspace.SortKey>,
): Promise<Page<Workspace>> {
	const where = compToSQL(
		spec,
		workspaceSpecToSQL as (s: unknown) => SQLFragment,
	);

	const sort = cursor.sort ?? {
		keys: ["createdAt", "id"] as const,
		order: "desc" as const,
	};
	const orderBy = sort.keys
		.map((k) => `${columnName(k)} ${sort.order.toUpperCase()}`)
		.join(", ");

	const limit = cursor.limit + 1;

	const rows = await db.queryAll<WorkspaceRow>({
		query: `SELECT * FROM workspaces WHERE ${where.query} ORDER BY ${orderBy} LIMIT ${limit}`,
		params: where.params,
	});

	const hasMore = rows.length > cursor.limit;
	const items = rows.slice(0, cursor.limit).map(rowToWorkspace);

	const lastItem = items[items.length - 1];
	const nextCursor =
		hasMore && lastItem ? Workspace.cursor(lastItem, sort.keys) : undefined;

	return { items, hasMore, nextCursor };
}
