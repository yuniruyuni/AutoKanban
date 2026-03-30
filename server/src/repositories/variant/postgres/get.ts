import type { PgDatabase } from "../../../db/pg-client";
import type { Variant } from "../../../models/variant";
import { compToSQL } from "../../common";
import type { SQLFragment } from "../../common";
import { rowToVariant, type VariantRow, variantSpecToSQL } from "./common";

export async function get(
	db: PgDatabase,
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
