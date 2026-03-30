import type { Database } from "../../../lib/db/database";
import type { SQLFragment } from "../../../lib/db/sql";
import { compToSQL } from "../../../lib/db/sql-helpers";
import type { Tool } from "../../../models/tool";
import { rowToTool, type ToolRow, toolSpecToSQL } from "./common";

export async function get(db: Database, spec: Tool.Spec): Promise<Tool | null> {
	const where = compToSQL(spec, toolSpecToSQL as (s: unknown) => SQLFragment);
	const row = await db.queryGet<ToolRow>({
		query: `SELECT * FROM tools WHERE ${where.query} LIMIT 1`,
		params: where.params,
	});

	return row ? rowToTool(row) : null;
}
