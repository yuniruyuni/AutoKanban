import type { Database } from "../../../infra/db/database";
import { dateToSQL } from "../../../infra/db/sql-helpers";
import type { Tool } from "../../../models/tool";

export async function upsert(db: Database, tool: Tool): Promise<void> {
	await db.queryRun({
		query: `INSERT INTO tools (id, name, icon, icon_color, command, argv, sort_order, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       name = excluded.name,
       icon = excluded.icon,
       icon_color = excluded.icon_color,
       command = excluded.command,
       argv = excluded.argv,
       sort_order = excluded.sort_order,
       updated_at = excluded.updated_at`,
		params: [
			tool.id,
			tool.name,
			tool.icon,
			tool.iconColor,
			tool.command,
			tool.argv === null ? null : JSON.stringify(tool.argv),
			tool.sortOrder,
			dateToSQL(tool.createdAt),
			dateToSQL(tool.updatedAt),
		],
	});
}
