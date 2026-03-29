import type { PgDatabase } from "../../../db/pg-client";
import type { Variant } from "../../../models/variant";
import { compToSQL } from "../../common";
import type { SQLFragment } from "../../sql";
import { variantSpecToSQL } from "./common";

export async function del(db: PgDatabase, spec: Variant.Spec): Promise<number> {
	const where = compToSQL(
		spec,
		variantSpecToSQL as (s: unknown) => SQLFragment,
	);
	const result = await db.queryRun({
		query: `DELETE FROM variants WHERE ${where.query}`,
		params: where.params,
	});

	return result.rowCount;
}
