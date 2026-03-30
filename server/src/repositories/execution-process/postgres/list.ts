import type { Database } from "../../../infra/db/database";
import type { SQLFragment } from "../../../infra/db/sql";
import { compToSQL } from "../../../infra/db/sql-helpers";
import type { Cursor, Page } from "../../../models/common";
import { ExecutionProcess } from "../../../models/execution-process";
import {
	columnName,
	type ExecutionProcessRow,
	executionProcessSpecToSQL,
	rowToExecutionProcess,
} from "./common";

export async function list(
	db: Database,
	spec: ExecutionProcess.Spec,
	cursor: Cursor<ExecutionProcess.SortKey>,
): Promise<Page<ExecutionProcess>> {
	const where = compToSQL(
		spec,
		executionProcessSpecToSQL as (s: unknown) => SQLFragment,
	);

	const sort = cursor.sort ?? {
		keys: ["startedAt", "id"] as const,
		order: "desc" as const,
	};
	const orderBy = sort.keys
		.map((k) => `${columnName(k)} ${sort.order.toUpperCase()}`)
		.join(", ");

	const limit = cursor.limit + 1;

	const rows = await db.queryAll<ExecutionProcessRow>({
		query: `SELECT * FROM execution_processes WHERE ${where.query} ORDER BY ${orderBy} LIMIT ${limit}`,
		params: where.params,
	});

	const hasMore = rows.length > cursor.limit;
	const items = rows.slice(0, cursor.limit).map(rowToExecutionProcess);

	const lastItem = items[items.length - 1];
	const nextCursor =
		hasMore && lastItem
			? ExecutionProcess.cursor(lastItem, sort.keys)
			: undefined;

	return { items, hasMore, nextCursor };
}
