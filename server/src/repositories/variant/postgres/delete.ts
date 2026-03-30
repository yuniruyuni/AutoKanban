import type { Database } from "../../../lib/db/database";
import type { SQLFragment } from "../../../lib/db/sql";
import { compToSQL } from "../../../lib/db/sql-helpers";
import type { Variant } from "../../../models/variant";
import { variantSpecToSQL } from "./common";

export async function del(db: Database, spec: Variant.Spec): Promise<number> {
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
