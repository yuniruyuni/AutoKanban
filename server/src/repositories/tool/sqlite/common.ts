import type { Tool } from "../../../models/tool";
import { dateFromSQL } from "../../common";
import { type SQLFragment, sql } from "../../sql";

export interface ToolRow {
	id: string;
	name: string;
	icon: string;
	icon_color: string;
	command: string;
	sort_order: number;
	created_at: string;
	updated_at: string;
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
		sortOrder: row.sort_order,
		createdAt: dateFromSQL(row.created_at),
		updatedAt: dateFromSQL(row.updated_at),
	};
}

export function columnName(key: Tool.SortKey): string {
	const map: Record<Tool.SortKey, string> = {
		sortOrder: "sort_order",
		createdAt: "created_at",
		id: "id",
	};
	return map[key];
}
