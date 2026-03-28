import type { Database, SQLQueryBindings } from "bun:sqlite";
import { spawn } from "bun";
import type { Cursor, Page } from "../models/common";
import { Tool } from "../models/tool";
import type { IToolRepository } from "../types/repository";
import { compToSQL, dateFromSQL, dateToSQL } from "./common";
import { type SQLFragment, sql } from "./sql";

// ============================================
// Row type
// ============================================

interface ToolRow {
	id: string;
	name: string;
	icon: string;
	icon_color: string;
	command: string;
	sort_order: number;
	created_at: string;
	updated_at: string;
}

// ============================================
// Spec to SQL converter
// ============================================

type ToolSpecData = { type: "ById"; id: string } | { type: "All" };

function toolSpecToSQL(spec: ToolSpecData): SQLFragment {
	switch (spec.type) {
		case "ById":
			return sql`id = ${spec.id}`;
		case "All":
			return sql`1 = 1`;
	}
}

// ============================================
// Row to Entity converter
// ============================================

function rowToTool(row: ToolRow): Tool {
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

// ============================================
// Tool Repository
// ============================================

export type SpawnFn = typeof spawn;

export class ToolRepository implements IToolRepository {
	private spawnFn: SpawnFn;

	constructor(
		private db: Database,
		spawnFn?: SpawnFn,
	) {
		this.spawnFn = spawnFn ?? spawn;
	}

	get(spec: Tool.Spec): Tool | null {
		const where = compToSQL(spec, toolSpecToSQL as (s: unknown) => SQLFragment);
		const row = this.db
			.query<ToolRow, SQLQueryBindings[]>(
				`SELECT * FROM tools WHERE ${where.query} LIMIT 1`,
			)
			.get(...(where.params as SQLQueryBindings[]));

		return row ? rowToTool(row) : null;
	}

	list(spec: Tool.Spec, cursor: Cursor<Tool.SortKey>): Page<Tool> {
		const where = compToSQL(spec, toolSpecToSQL as (s: unknown) => SQLFragment);

		// Build ORDER BY
		const sort = cursor.sort ?? {
			keys: ["sortOrder", "id"] as const,
			order: "asc" as const,
		};
		const orderBy = sort.keys
			.map((k) => `${this.columnName(k)} ${sort.order.toUpperCase()}`)
			.join(", ");

		// Fetch one extra to determine hasMore
		const limit = cursor.limit + 1;

		const rows = this.db
			.query<ToolRow, SQLQueryBindings[]>(
				`SELECT * FROM tools WHERE ${where.query} ORDER BY ${orderBy} LIMIT ${limit}`,
			)
			.all(...(where.params as SQLQueryBindings[]));

		const hasMore = rows.length > cursor.limit;
		const items = rows.slice(0, cursor.limit).map(rowToTool);

		const lastItem = items[items.length - 1];
		const nextCursor =
			hasMore && lastItem ? Tool.cursor(lastItem, sort.keys) : undefined;

		return { items, hasMore, nextCursor };
	}

	listAll(): Tool[] {
		const rows = this.db
			.query<ToolRow, []>(`SELECT * FROM tools ORDER BY sort_order ASC, id ASC`)
			.all();

		return rows.map(rowToTool);
	}

	upsert(tool: Tool): void {
		this.db
			.query(
				`INSERT INTO tools (id, name, icon, icon_color, command, sort_order, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           name = excluded.name,
           icon = excluded.icon,
           icon_color = excluded.icon_color,
           command = excluded.command,
           sort_order = excluded.sort_order,
           updated_at = excluded.updated_at`,
			)
			.run(
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

	delete(spec: Tool.Spec): number {
		const where = compToSQL(spec, toolSpecToSQL as (s: unknown) => SQLFragment);
		const result = this.db
			.query<{ changes: number }, SQLQueryBindings[]>(
				`DELETE FROM tools WHERE ${where.query}`,
			)
			.run(...(where.params as SQLQueryBindings[]));

		return result.changes;
	}

	executeCommand(command: string, cwd?: string): void {
		this.spawnFn({
			cmd: ["sh", "-c", command],
			cwd: cwd || undefined,
			stdout: "inherit",
			stderr: "inherit",
		});
	}

	private columnName(key: Tool.SortKey): string {
		const map: Record<Tool.SortKey, string> = {
			sortOrder: "sort_order",
			createdAt: "created_at",
			id: "id",
		};
		return map[key];
	}
}
