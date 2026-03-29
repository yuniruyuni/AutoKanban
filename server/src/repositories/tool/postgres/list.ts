import type { PgDatabase } from "../../../db/pg-client";
import type { Cursor, Page } from "../../../models/common";
import { Tool } from "../../../models/tool";
import { compToSQL } from "../../common";
import type { SQLFragment } from "../../sql";
import { type ToolRow, columnName, rowToTool, toolSpecToSQL } from "./common";

export async function list(
	db: PgDatabase,
	spec: Tool.Spec,
	cursor: Cursor<Tool.SortKey>,
): Promise<Page<Tool>> {
	const where = compToSQL(spec, toolSpecToSQL as (s: unknown) => SQLFragment);

	const sort = cursor.sort ?? {
		keys: ["sortOrder", "id"] as const,
		order: "asc" as const,
	};
	const orderBy = sort.keys
		.map((k) => `${columnName(k)} ${sort.order.toUpperCase()}`)
		.join(", ");

	const limit = cursor.limit + 1;

	const rows = await db.queryAll<ToolRow>({
		query: `SELECT * FROM tools WHERE ${where.query} ORDER BY ${orderBy} LIMIT ${limit}`,
		params: where.params,
	});

	const hasMore = rows.length > cursor.limit;
	const items = rows.slice(0, cursor.limit).map(rowToTool);

	const lastItem = items[items.length - 1];
	const nextCursor =
		hasMore && lastItem ? Tool.cursor(lastItem, sort.keys) : undefined;

	return { items, hasMore, nextCursor };
}
