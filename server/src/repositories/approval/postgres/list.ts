import type { PgDatabase } from "../../../db/pg-client";
import { Approval } from "../../../models/approval";
import type { Cursor, Page } from "../../../models/common";
import { compToSQL } from "../../common";
import type { SQLFragment } from "../../common";
import {
	type ApprovalRow,
	approvalSpecToSQL,
	columnName,
	rowToApproval,
} from "./common";

export async function list(
	db: PgDatabase,
	spec: Approval.Spec,
	cursor: Cursor<Approval.SortKey>,
): Promise<Page<Approval>> {
	const where = compToSQL(
		spec,
		approvalSpecToSQL as (s: unknown) => SQLFragment,
	);

	const sort = cursor.sort ?? Approval.defaultSort;
	const orderBy = sort.keys
		.map((k) => `${columnName(k)} ${sort.order.toUpperCase()}`)
		.join(", ");

	const limit = cursor.limit + 1;

	const rows = await db.queryAll<ApprovalRow>({
		query: `SELECT * FROM approvals WHERE ${where.query} ORDER BY ${orderBy} LIMIT ${limit}`,
		params: where.params,
	});

	const hasMore = rows.length > cursor.limit;
	const items = rows.slice(0, cursor.limit).map(rowToApproval);

	const lastItem = items[items.length - 1];
	const nextCursor =
		hasMore && lastItem ? Approval.cursor(lastItem, sort.keys) : undefined;

	return { items, hasMore, nextCursor };
}
