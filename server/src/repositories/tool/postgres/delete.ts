import type { Database } from "../../../lib/db/database";
import type { SQLFragment } from "../../../lib/db/sql";
import { compToSQL } from "../../../lib/db/sql-helpers";
import type { Tool } from "../../../models/tool";
import { toolSpecToSQL } from "./common";

export async function del(db: Database, spec: Tool.Spec): Promise<number> {
	const where = compToSQL(spec, toolSpecToSQL as (s: unknown) => SQLFragment);
	const result = await db.queryRun({
		query: `DELETE FROM tools WHERE ${where.query}`,
		params: where.params,
	});

	return result.rowCount;
}
