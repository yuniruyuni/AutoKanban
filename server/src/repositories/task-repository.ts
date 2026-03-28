import type { Database, SQLQueryBindings } from "bun:sqlite";
import type { Cursor, Page } from "../models/common";
import { Task } from "../models/task";
import type { ITaskRepository } from "../types/repository";
import { compToSQL, dateFromSQL, dateToSQL } from "./common";
import { type SQLFragment, sql } from "./sql";

// ============================================
// Row type
// ============================================

interface TaskRow {
	id: string;
	project_id: string;
	title: string;
	description: string | null;
	status: string;
	created_at: string;
	updated_at: string;
}

// ============================================
// Spec to SQL converter
// ============================================

type TaskSpecData =
	| { type: "ById"; id: string }
	| { type: "ByProject"; projectId: string }
	| { type: "ByStatus"; status: Task.Status }
	| { type: "ByStatuses"; statuses: Task.Status[] };

function taskSpecToSQL(spec: TaskSpecData): SQLFragment {
	switch (spec.type) {
		case "ById":
			return sql`id = ${spec.id}`;
		case "ByProject":
			return sql`project_id = ${spec.projectId}`;
		case "ByStatus":
			return sql`status = ${spec.status}`;
		case "ByStatuses":
			return sql`status IN (${sql.list(spec.statuses)})`;
	}
}

// ============================================
// Row to Entity converter
// ============================================

function rowToTask(row: TaskRow): Task {
	return {
		id: row.id,
		projectId: row.project_id,
		title: row.title,
		description: row.description,
		status: row.status as Task.Status,
		createdAt: dateFromSQL(row.created_at),
		updatedAt: dateFromSQL(row.updated_at),
	};
}

// ============================================
// Task Repository
// ============================================

export class TaskRepository implements ITaskRepository {
	constructor(private db: Database) {}

	get(spec: Task.Spec): Task | null {
		const where = compToSQL(spec, taskSpecToSQL as (s: unknown) => SQLFragment);
		const row = this.db
			.query<TaskRow, SQLQueryBindings[]>(
				`SELECT * FROM tasks WHERE ${where.query} LIMIT 1`,
			)
			.get(...(where.params as SQLQueryBindings[]));

		return row ? rowToTask(row) : null;
	}

	list(spec: Task.Spec, cursor: Cursor<Task.SortKey>): Page<Task> {
		const where = compToSQL(spec, taskSpecToSQL as (s: unknown) => SQLFragment);

		// Build ORDER BY
		const sort = cursor.sort ?? {
			keys: ["createdAt", "id"] as const,
			order: "desc" as const,
		};
		const orderBy = sort.keys
			.map((k) => `${this.columnName(k)} ${sort.order.toUpperCase()}`)
			.join(", ");

		// Fetch one extra to determine hasMore
		const limit = cursor.limit + 1;

		const rows = this.db
			.query<TaskRow, SQLQueryBindings[]>(
				`SELECT * FROM tasks WHERE ${where.query} ORDER BY ${orderBy} LIMIT ${limit}`,
			)
			.all(...(where.params as SQLQueryBindings[]));

		const hasMore = rows.length > cursor.limit;
		const items = rows.slice(0, cursor.limit).map(rowToTask);

		const lastItem = items[items.length - 1];
		const nextCursor =
			hasMore && lastItem ? Task.cursor(lastItem, sort.keys) : undefined;

		return { items, hasMore, nextCursor };
	}

	upsert(task: Task): void {
		this.db
			.query(
				`INSERT INTO tasks (id, project_id, title, description, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           title = excluded.title,
           description = excluded.description,
           status = excluded.status,
           updated_at = excluded.updated_at`,
			)
			.run(
				task.id,
				task.projectId,
				task.title,
				task.description,
				task.status,
				dateToSQL(task.createdAt),
				dateToSQL(task.updatedAt),
			);
	}

	delete(spec: Task.Spec): number {
		const where = compToSQL(spec, taskSpecToSQL as (s: unknown) => SQLFragment);
		const result = this.db
			.query<{ changes: number }, SQLQueryBindings[]>(
				`DELETE FROM tasks WHERE ${where.query}`,
			)
			.run(...(where.params as SQLQueryBindings[]));

		return result.changes;
	}

	count(spec: Task.Spec): number {
		const where = compToSQL(spec, taskSpecToSQL as (s: unknown) => SQLFragment);
		const row = this.db
			.query<{ count: number }, SQLQueryBindings[]>(
				`SELECT COUNT(*) as count FROM tasks WHERE ${where.query}`,
			)
			.get(...(where.params as SQLQueryBindings[]));

		return row?.count ?? 0;
	}

	private columnName(key: Task.SortKey): string {
		const map: Record<Task.SortKey, string> = {
			createdAt: "created_at",
			updatedAt: "updated_at",
			id: "id",
		};
		return map[key];
	}
}
