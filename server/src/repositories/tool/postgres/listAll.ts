import type { PgDatabase } from "../../../db/pg-client";
import type { Tool } from "../../../models/tool";
import { type ToolRow, rowToTool } from "./common";

export async function listAll(db: PgDatabase): Promise<Tool[]> {
	const rows = await db.queryAll<ToolRow>({
		query: "SELECT * FROM tools ORDER BY sort_order ASC, id ASC",
		params: [],
	});

	return rows.map(rowToTool);
}
