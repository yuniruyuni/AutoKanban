import type { Database, SQLQueryBindings } from "bun:sqlite";
import type { Cursor, Page } from "../../../models/common";
import { Tool } from "../../../models/tool";
import { compToSQL } from "../../common";
import type { SQLFragment } from "../../sql";
import { columnName, rowToTool, type ToolRow, toolSpecToSQL } from "./common";

export function list(
	db: Database,
	spec: Tool.Spec,
	cursor: Cursor<Tool.SortKey>,
): Page<Tool> {
	const where = compToSQL(spec, toolSpecToSQL as (s: unknown) => SQLFragment);

	const sort = cursor.sort ?? {
		keys: ["sortOrder", "id"] as const,
		order: "asc" as const,
	};
	const orderBy = sort.keys
		.map((k) => `${columnName(k)} ${sort.order.toUpperCase()}`)
		.join(", ");

	const limit = cursor.limit + 1;

	const rows = db
		.query<ToolRow, SQLQueryBindings[]>(
			`SELECT * FROM tools WHERE ${where.query} ORDER BY ${orderBy} LIMIT ${limit}`,
		)
		.all(...(where.params as SQLQueryBindings[]));

	const hasMore = rows.length > cursor.limit;
	const items = rows.slice(0, cursor.limit).map(rowToTool);

	const lastItem = items[items.length - 1];
	const nextCursor =
		hasMore && lastItem ? Tool.cursor(lastItem, sort.keys) : undefined;

	return { items, hasMore, nextCursor };
}
