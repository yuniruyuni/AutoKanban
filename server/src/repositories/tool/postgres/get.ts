import type { PgDatabase } from "../../../db/pg-client";
import type { Tool } from "../../../models/tool";
import { compToSQL } from "../../common";
import type { SQLFragment } from "../../sql";
import { type ToolRow, rowToTool, toolSpecToSQL } from "./common";

export async function get(
	db: PgDatabase,
	spec: Tool.Spec,
): Promise<Tool | null> {
	const where = compToSQL(spec, toolSpecToSQL as (s: unknown) => SQLFragment);
	const row = await db.queryGet<ToolRow>({
		query: `SELECT * FROM tools WHERE ${where.query} LIMIT 1`,
		params: where.params,
	});

	return row ? rowToTool(row) : null;
}
