import type { Database } from "../../../infra/db/database";
import type { SQLFragment } from "../../../infra/db/sql";
import { compToSQL } from "../../../infra/db/sql-helpers";
import { CodingAgentProcess } from "../../../models/coding-agent-process";
import type { Cursor, Page } from "../../../models/common";
import {
	type CodingAgentProcessRow,
	codingAgentProcessSpecToSQL,
	columnName,
	rowToCodingAgentProcess,
} from "./common";

export async function list(
	db: Database,
	spec: CodingAgentProcess.Spec,
	cursor: Cursor<CodingAgentProcess.SortKey>,
): Promise<Page<CodingAgentProcess>> {
	const where = compToSQL(
		spec,
		codingAgentProcessSpecToSQL as (s: unknown) => SQLFragment,
	);

	const sort = cursor.sort ?? {
		keys: ["startedAt", "id"] as const,
		order: "desc" as const,
	};
	const orderBy = sort.keys
		.map((k) => `${columnName(k)} ${sort.order.toUpperCase()}`)
		.join(", ");

	const limit = cursor.limit + 1;

	const rows = await db.queryAll<CodingAgentProcessRow>({
		query: `SELECT * FROM coding_agent_processes WHERE ${where.query} ORDER BY ${orderBy} LIMIT ${limit}`,
		params: where.params,
	});

	const hasMore = rows.length > cursor.limit;
	const items = rows.slice(0, cursor.limit).map(rowToCodingAgentProcess);

	const lastItem = items[items.length - 1];
	const nextCursor =
		hasMore && lastItem
			? CodingAgentProcess.cursor(lastItem, sort.keys)
			: undefined;

	return { items, hasMore, nextCursor };
}
