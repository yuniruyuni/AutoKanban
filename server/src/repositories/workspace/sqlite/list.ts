import type { Database, SQLQueryBindings } from "bun:sqlite";
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

export function list(
	db: Database,
	spec: Workspace.Spec,
	cursor: Cursor<Workspace.SortKey>,
): Page<Workspace> {
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

	const rows = db
		.query<WorkspaceRow, SQLQueryBindings[]>(
			`SELECT * FROM workspaces WHERE ${where.query} ORDER BY ${orderBy} LIMIT ${limit}`,
		)
		.all(...(where.params as SQLQueryBindings[]));

	const hasMore = rows.length > cursor.limit;
	const items = rows.slice(0, cursor.limit).map(rowToWorkspace);

	const lastItem = items[items.length - 1];
	const nextCursor =
		hasMore && lastItem ? Workspace.cursor(lastItem, sort.keys) : undefined;

	return { items, hasMore, nextCursor };
}
