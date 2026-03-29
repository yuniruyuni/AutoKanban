import type { Database } from "bun:sqlite";
import type { Tool } from "../../../models/tool";
import { type ToolRow, rowToTool } from "./common";

export function listAll(db: Database): Tool[] {
	const rows = db
		.query<ToolRow, []>(`SELECT * FROM tools ORDER BY sort_order ASC, id ASC`)
		.all();

	return rows.map(rowToTool);
}
