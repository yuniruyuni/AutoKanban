import type { Database, SQLQueryBindings } from "bun:sqlite";
import type { Variant } from "../../../models/variant";
import { compToSQL } from "../../common";
import type { SQLFragment } from "../../sql";
import { rowToVariant, type VariantRow, variantSpecToSQL } from "./common";

export function get(db: Database, spec: Variant.Spec): Variant | null {
	const where = compToSQL(
		spec,
		variantSpecToSQL as (s: unknown) => SQLFragment,
	);
	const row = db
		.query<VariantRow, SQLQueryBindings[]>(
			`SELECT * FROM variants WHERE ${where.query} LIMIT 1`,
		)
		.get(...(where.params as SQLQueryBindings[]));

	return row ? rowToVariant(row) : null;
}
