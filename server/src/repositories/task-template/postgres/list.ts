import type { PgDatabase } from "../../../db/pg-client";
import type { Cursor, Page } from "../../../models/common";
import { TaskTemplate } from "../../../models/task-template";
import { compToSQL } from "../../common";
import type { SQLFragment } from "../../common";
import {
	columnName,
	rowToTaskTemplate,
	type TaskTemplateRow,
	taskTemplateSpecToSQL,
} from "./common";

export async function list(
	db: PgDatabase,
	spec: TaskTemplate.Spec,
	cursor: Cursor<TaskTemplate.SortKey>,
): Promise<Page<TaskTemplate>> {
	const where = compToSQL(
		spec,
		taskTemplateSpecToSQL as (s: unknown) => SQLFragment,
	);

	const sort = cursor.sort ?? TaskTemplate.defaultSort;
	const orderBy = sort.keys
		.map((k) => `${columnName(k)} ${sort.order.toUpperCase()}`)
		.join(", ");

	const limit = cursor.limit + 1;

	const rows = await db.queryAll<TaskTemplateRow>({
		query: `SELECT * FROM project_task_templates WHERE ${where.query} ORDER BY ${orderBy} LIMIT ${limit}`,
		params: where.params,
	});

	const hasMore = rows.length > cursor.limit;
	const items = rows.slice(0, cursor.limit).map(rowToTaskTemplate);

	const lastItem = items[items.length - 1];
	const nextCursor =
		hasMore && lastItem ? TaskTemplate.cursor(lastItem, sort.keys) : undefined;

	return { items, hasMore, nextCursor };
}
