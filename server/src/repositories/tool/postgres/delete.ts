import type { PgDatabase } from "../../../db/pg-client";
import type { Tool } from "../../../models/tool";
import { compToSQL } from "../../common";
import type { SQLFragment } from "../../sql";
import { toolSpecToSQL } from "./common";

export async function del(db: PgDatabase, spec: Tool.Spec): Promise<number> {
	const where = compToSQL(spec, toolSpecToSQL as (s: unknown) => SQLFragment);
	const result = await db.queryRun({
		query: `DELETE FROM tools WHERE ${where.query}`,
		params: where.params,
	});

	return result.rowCount;
}
