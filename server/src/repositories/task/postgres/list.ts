import type { PgDatabase } from "../../../db/pg-client";
import type { Cursor, Page } from "../../../models/common";
import { Task } from "../../../models/task";
import { compToSQL } from "../../common";
import type { SQLFragment } from "../../common";
import { columnName, rowToTask, type TaskRow, taskSpecToSQL } from "./common";

export async function list(
	db: PgDatabase,
	spec: Task.Spec,
	cursor: Cursor<Task.SortKey>,
): Promise<Page<Task>> {
	const where = compToSQL(spec, taskSpecToSQL as (s: unknown) => SQLFragment);

	const sort = cursor.sort ?? {
		keys: ["createdAt", "id"] as const,
		order: "desc" as const,
	};
	const orderBy = sort.keys
		.map((k) => `${columnName(k)} ${sort.order.toUpperCase()}`)
		.join(", ");

	const limit = cursor.limit + 1;

	const rows = await db.queryAll<TaskRow>({
		query: `SELECT * FROM tasks WHERE ${where.query} ORDER BY ${orderBy} LIMIT ${limit}`,
		params: where.params,
	});

	const hasMore = rows.length > cursor.limit;
	const items = rows.slice(0, cursor.limit).map(rowToTask);

	const lastItem = items[items.length - 1];
	const nextCursor =
		hasMore && lastItem ? Task.cursor(lastItem, sort.keys) : undefined;

	return { items, hasMore, nextCursor };
}
