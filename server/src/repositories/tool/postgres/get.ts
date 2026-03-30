import type { Database } from "../../common";
import type { Tool } from "../../../models/tool";
import { compToSQL } from "../../common";
import type { SQLFragment } from "../../common";
import { rowToTool, type ToolRow, toolSpecToSQL } from "./common";

export async function get(
	db: Database,
	spec: Tool.Spec,
): Promise<Tool | null> {
	const where = compToSQL(spec, toolSpecToSQL as (s: unknown) => SQLFragment);
	const row = await db.queryGet<ToolRow>({
		query: `SELECT * FROM tools WHERE ${where.query} LIMIT 1`,
		params: where.params,
	});

	return row ? rowToTool(row) : null;
}
