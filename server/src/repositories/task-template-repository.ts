import type { Database, SQLQueryBindings } from "bun:sqlite";
import type { Cursor, Page } from "../models/common";
import { TaskTemplate } from "../models/task-template";
import type { ITaskTemplateRepository } from "../types/repository";
import { compToSQL, dateFromSQL, dateToSQL } from "./common";
import { type SQLFragment, sql } from "./sql";

// ============================================
// Row type
// ============================================

interface TaskTemplateRow {
	id: string;
	title: string;
	description: string | null;
	condition: string | null;
	sort_order: number;
	created_at: string;
	updated_at: string;
}

// ============================================
// Spec to SQL converter
// ============================================

type TaskTemplateSpecData = { type: "ById"; id: string } | { type: "All" };

function taskTemplateSpecToSQL(spec: TaskTemplateSpecData): SQLFragment {
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

function rowToTaskTemplate(row: TaskTemplateRow): TaskTemplate {
	return {
		id: row.id,
		title: row.title,
		description: row.description,
		condition: row.condition as TaskTemplate.Condition,
		sortOrder: row.sort_order,
		createdAt: dateFromSQL(row.created_at),
		updatedAt: dateFromSQL(row.updated_at),
	};
}

// ============================================
// TaskTemplate Repository
// ============================================

export class TaskTemplateRepository implements ITaskTemplateRepository {
	constructor(private db: Database) {}

	get(spec: TaskTemplate.Spec): TaskTemplate | null {
		const where = compToSQL(
			spec,
			taskTemplateSpecToSQL as (s: unknown) => SQLFragment,
		);
		const row = this.db
			.query<TaskTemplateRow, SQLQueryBindings[]>(
				`SELECT * FROM project_task_templates WHERE ${where.query} LIMIT 1`,
			)
			.get(...(where.params as SQLQueryBindings[]));

		return row ? rowToTaskTemplate(row) : null;
	}

	list(
		spec: TaskTemplate.Spec,
		cursor: Cursor<TaskTemplate.SortKey>,
	): Page<TaskTemplate> {
		const where = compToSQL(
			spec,
			taskTemplateSpecToSQL as (s: unknown) => SQLFragment,
		);

		const sort = cursor.sort ?? TaskTemplate.defaultSort;
		const orderBy = sort.keys
			.map((k) => `${this.columnName(k)} ${sort.order.toUpperCase()}`)
			.join(", ");

		const limit = cursor.limit + 1;

		const rows = this.db
			.query<TaskTemplateRow, SQLQueryBindings[]>(
				`SELECT * FROM project_task_templates WHERE ${where.query} ORDER BY ${orderBy} LIMIT ${limit}`,
			)
			.all(...(where.params as SQLQueryBindings[]));

		const hasMore = rows.length > cursor.limit;
		const items = rows.slice(0, cursor.limit).map(rowToTaskTemplate);

		const lastItem = items[items.length - 1];
		const nextCursor =
			hasMore && lastItem
				? TaskTemplate.cursor(lastItem, sort.keys)
				: undefined;

		return { items, hasMore, nextCursor };
	}

	listAll(): TaskTemplate[] {
		const rows = this.db
			.query<TaskTemplateRow, []>(
				"SELECT * FROM project_task_templates ORDER BY sort_order ASC, id ASC",
			)
			.all();
		return rows.map(rowToTaskTemplate);
	}

	upsert(template: TaskTemplate): void {
		this.db
			.query(
				`INSERT INTO project_task_templates (id, title, description, condition, sort_order, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         title = excluded.title,
         description = excluded.description,
         condition = excluded.condition,
         sort_order = excluded.sort_order,
         updated_at = excluded.updated_at`,
			)
			.run(
				template.id,
				template.title,
				template.description,
				template.condition,
				template.sortOrder,
				dateToSQL(template.createdAt),
				dateToSQL(template.updatedAt),
			);
	}

	delete(spec: TaskTemplate.Spec): number {
		const where = compToSQL(
			spec,
			taskTemplateSpecToSQL as (s: unknown) => SQLFragment,
		);
		const result = this.db
			.query<{ changes: number }, SQLQueryBindings[]>(
				`DELETE FROM project_task_templates WHERE ${where.query}`,
			)
			.run(...(where.params as SQLQueryBindings[]));

		return result.changes;
	}

	private columnName(key: TaskTemplate.SortKey): string {
		const map: Record<TaskTemplate.SortKey, string> = {
			sortOrder: "sort_order",
			createdAt: "created_at",
			id: "id",
		};
		return map[key];
	}
}
