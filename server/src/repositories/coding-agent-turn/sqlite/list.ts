import type { Database, SQLQueryBindings } from "bun:sqlite";
import {
	CodingAgentTurn,
} from "../../../models/coding-agent-turn";
import type { Cursor, Page } from "../../../models/common";
import { compToSQL } from "../../common";
import type { SQLFragment } from "../../sql";
import {
	type CodingAgentTurnRow,
	codingAgentTurnSpecToSQL,
	columnName,
	rowToCodingAgentTurn,
} from "./common";

export function list(
	db: Database,
	spec: CodingAgentTurn.Spec,
	cursor: Cursor<CodingAgentTurn.SortKey>,
): Page<CodingAgentTurn> {
	const where = compToSQL(
		spec,
		codingAgentTurnSpecToSQL as (s: unknown) => SQLFragment,
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
		.query<CodingAgentTurnRow, SQLQueryBindings[]>(
			`SELECT * FROM coding_agent_turns WHERE ${where.query} ORDER BY ${orderBy} LIMIT ${limit}`,
		)
		.all(...(where.params as SQLQueryBindings[]));

	const hasMore = rows.length > cursor.limit;
	const items = rows.slice(0, cursor.limit).map(rowToCodingAgentTurn);

	const lastItem = items[items.length - 1];
	const nextCursor =
		hasMore && lastItem
			? CodingAgentTurn.cursor(lastItem, sort.keys)
			: undefined;

	return { items, hasMore, nextCursor };
}
