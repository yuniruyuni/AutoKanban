import type { Database, SQLQueryBindings } from "bun:sqlite";
import type { Cursor, Page } from "../../../models/common";
import { ExecutionProcess } from "../../../models/execution-process";
import { compToSQL } from "../../common";
import type { SQLFragment } from "../../sql";
import {
	type ExecutionProcessRow,
	columnName,
	executionProcessSpecToSQL,
	rowToExecutionProcess,
} from "./common";

export function list(
	db: Database,
	spec: ExecutionProcess.Spec,
	cursor: Cursor<ExecutionProcess.SortKey>,
): Page<ExecutionProcess> {
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

	const rows = db
		.query<ExecutionProcessRow, SQLQueryBindings[]>(
			`SELECT * FROM execution_processes WHERE ${where.query} ORDER BY ${orderBy} LIMIT ${limit}`,
		)
		.all(...(where.params as SQLQueryBindings[]));

	const hasMore = rows.length > cursor.limit;
	const items = rows.slice(0, cursor.limit).map(rowToExecutionProcess);

	const lastItem = items[items.length - 1];
	const nextCursor =
		hasMore && lastItem
			? ExecutionProcess.cursor(lastItem, sort.keys)
			: undefined;

	return { items, hasMore, nextCursor };
}
