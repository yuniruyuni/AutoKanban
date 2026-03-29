import type { Database, SQLQueryBindings } from "bun:sqlite";
import type { Cursor, Page } from "../../../models/common";
import { Variant } from "../../../models/variant";
import { compToSQL } from "../../common";
import type { SQLFragment } from "../../sql";
import {
	type VariantRow,
	columnName,
	rowToVariant,
	variantSpecToSQL,
} from "./common";

export function list(
	db: Database,
	spec: Variant.Spec,
	cursor: Cursor<Variant.SortKey>,
): Page<Variant> {
	const where = compToSQL(
		spec,
		variantSpecToSQL as (s: unknown) => SQLFragment,
	);

	const sort = cursor.sort ?? Variant.defaultSort;
	const orderBy = sort.keys
		.map((k) => `${columnName(k)} ${sort.order.toUpperCase()}`)
		.join(", ");

	const limit = cursor.limit + 1;

	const rows = db
		.query<VariantRow, SQLQueryBindings[]>(
			`SELECT * FROM variants WHERE ${where.query} ORDER BY ${orderBy} LIMIT ${limit}`,
		)
		.all(...(where.params as SQLQueryBindings[]));

	const hasMore = rows.length > cursor.limit;
	const items = rows.slice(0, cursor.limit).map(rowToVariant);

	const lastItem = items[items.length - 1];
	const nextCursor =
		hasMore && lastItem ? Variant.cursor(lastItem, sort.keys) : undefined;

	return { items, hasMore, nextCursor };
}
