import type { Database } from "../../../lib/db/database";
import type { SQLFragment } from "../../../lib/db/sql";
import { compToSQL } from "../../../lib/db/sql-helpers";
import type { Variant } from "../../../models/variant";
import { rowToVariant, type VariantRow, variantSpecToSQL } from "./common";

export async function get(
	db: Database,
	spec: Variant.Spec,
): Promise<Variant | null> {
	const where = compToSQL(
		spec,
		variantSpecToSQL as (s: unknown) => SQLFragment,
	);
	const row = await db.queryGet<VariantRow>({
		query: `SELECT * FROM variants WHERE ${where.query} LIMIT 1`,
		params: where.params,
	});

	return row ? rowToVariant(row) : null;
}
