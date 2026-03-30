import type { Database } from "../../common";
import type { Tool } from "../../../models/tool";
import { compToSQL } from "../../common";
import type { SQLFragment } from "../../common";
import { toolSpecToSQL } from "./common";

export async function del(db: Database, spec: Tool.Spec): Promise<number> {
	const where = compToSQL(spec, toolSpecToSQL as (s: unknown) => SQLFragment);
	const result = await db.queryRun({
		query: `DELETE FROM tools WHERE ${where.query}`,
		params: where.params,
	});

	return result.rowCount;
}
