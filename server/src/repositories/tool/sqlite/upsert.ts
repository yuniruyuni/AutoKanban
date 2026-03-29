import type { Database } from "bun:sqlite";
import type { Tool } from "../../../models/tool";
import { dateToSQL } from "../../common";

export function upsert(db: Database, tool: Tool): void {
	db.query(
		`INSERT INTO tools (id, name, icon, icon_color, command, sort_order, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       name = excluded.name,
       icon = excluded.icon,
       icon_color = excluded.icon_color,
       command = excluded.command,
       sort_order = excluded.sort_order,
       updated_at = excluded.updated_at`,
	).run(
		tool.id,
		tool.name,
		tool.icon,
		tool.iconColor,
		tool.command,
		tool.sortOrder,
		dateToSQL(tool.createdAt),
		dateToSQL(tool.updatedAt),
	);
}
