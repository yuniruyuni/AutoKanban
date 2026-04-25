import { type SQLFragment, sql } from "../../../infra/db/sql";
import { dateFromSQL } from "../../../infra/db/sql-helpers";
import type { Tool } from "../../../models/tool";

export interface ToolRow {
	id: string;
	name: string;
	icon: string;
	icon_color: string;
	command: string;
	argv: string[] | null;
	sort_order: number;
	created_at: Date;
	updated_at: Date;
}

type ToolSpecData = { type: "ById"; id: string } | { type: "All" };

export function toolSpecToSQL(spec: ToolSpecData): SQLFragment {
	switch (spec.type) {
		case "ById":
			return sql`id = ${spec.id}`;
		case "All":
			return sql`1 = 1`;
	}
}

export function rowToTool(row: ToolRow): Tool {
	return {
		id: row.id,
		name: row.name,
		icon: row.icon,
		iconColor: row.icon_color,
		command: row.command,
		argv: parseArgv(row.argv),
		sortOrder: row.sort_order,
		createdAt: dateFromSQL(row.created_at),
		updatedAt: dateFromSQL(row.updated_at),
	};
}

// pg returns JSONB as a parsed JS value, but row data may also arrive as a
// raw string in tests / non-pg drivers. Accept both, reject anything that is
// not an array of strings.
function parseArgv(value: unknown): string[] | null {
	if (value == null) return null;
	const parsed = typeof value === "string" ? JSON.parse(value) : value;
	if (!Array.isArray(parsed)) return null;
	if (!parsed.every((v) => typeof v === "string")) return null;
	return parsed;
}

export function columnName(key: Tool.SortKey): string {
	const map: Record<Tool.SortKey, string> = {
		sortOrder: "sort_order",
		createdAt: "created_at",
		id: "id",
	};
	return map[key];
}
