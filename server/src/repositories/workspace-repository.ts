import type { Database, SQLQueryBindings } from "bun:sqlite";
import type { Cursor, Page } from "../models/common";
import { Workspace } from "../models/workspace";
import type { IWorkspaceRepository } from "../types/repository";
import { compToSQL, dateFromSQL, dateToSQL } from "./common";
import { type SQLFragment, sql } from "./sql";

// ============================================
// Row type
// ============================================

interface WorkspaceRow {
	id: string;
	task_id: string;
	container_ref: string;
	branch: string;
	worktree_path: string | null;
	setup_complete: number;
	attempt: number;
	archived: number;
	created_at: string;
	updated_at: string;
}

// ============================================
// Spec to SQL converter
// ============================================

type WorkspaceSpecData =
	| { type: "ById"; id: string }
	| { type: "ByTaskId"; taskId: string }
	| { type: "ByTaskIdActive"; taskId: string };

function workspaceSpecToSQL(spec: WorkspaceSpecData): SQLFragment {
	switch (spec.type) {
		case "ById":
			return sql`id = ${spec.id}`;
		case "ByTaskId":
			return sql`task_id = ${spec.taskId}`;
		case "ByTaskIdActive":
			return sql`task_id = ${spec.taskId} AND archived = 0`;
	}
}

// ============================================
// Row to Entity converter
// ============================================

function rowToWorkspace(row: WorkspaceRow): Workspace {
	return {
		id: row.id,
		taskId: row.task_id,
		containerRef: row.container_ref,
		branch: row.branch,
		worktreePath: row.worktree_path,
		setupComplete: row.setup_complete === 1,
		attempt: row.attempt,
		archived: row.archived === 1,
		createdAt: dateFromSQL(row.created_at),
		updatedAt: dateFromSQL(row.updated_at),
	};
}

// ============================================
// Workspace Repository
// ============================================

export class WorkspaceRepository implements IWorkspaceRepository {
	constructor(private db: Database) {}

	get(spec: Workspace.Spec): Workspace | null {
		const where = compToSQL(
			spec,
			workspaceSpecToSQL as (s: unknown) => SQLFragment,
		);
		const row = this.db
			.query<WorkspaceRow, SQLQueryBindings[]>(
				`SELECT * FROM workspaces WHERE ${where.query} LIMIT 1`,
			)
			.get(...(where.params as SQLQueryBindings[]));

		return row ? rowToWorkspace(row) : null;
	}

	list(
		spec: Workspace.Spec,
		cursor: Cursor<Workspace.SortKey>,
	): Page<Workspace> {
		const where = compToSQL(
			spec,
			workspaceSpecToSQL as (s: unknown) => SQLFragment,
		);

		const sort = cursor.sort ?? {
			keys: ["createdAt", "id"] as const,
			order: "desc" as const,
		};
		const orderBy = sort.keys
			.map((k) => `${this.columnName(k)} ${sort.order.toUpperCase()}`)
			.join(", ");

		const limit = cursor.limit + 1;

		const rows = this.db
			.query<WorkspaceRow, SQLQueryBindings[]>(
				`SELECT * FROM workspaces WHERE ${where.query} ORDER BY ${orderBy} LIMIT ${limit}`,
			)
			.all(...(where.params as SQLQueryBindings[]));

		const hasMore = rows.length > cursor.limit;
		const items = rows.slice(0, cursor.limit).map(rowToWorkspace);

		const lastItem = items[items.length - 1];
		const nextCursor =
			hasMore && lastItem ? Workspace.cursor(lastItem, sort.keys) : undefined;

		return { items, hasMore, nextCursor };
	}

	findByWorktreePath(worktreePath: string): Workspace | null {
		const row = this.db
			.query<WorkspaceRow, [string]>(
				`SELECT * FROM workspaces WHERE worktree_path = ? LIMIT 1`,
			)
			.get(worktreePath);

		return row ? rowToWorkspace(row) : null;
	}

	getMaxAttempt(taskId: string): number {
		const row = this.db
			.query<{ max_attempt: number | null }, [string]>(
				`SELECT MAX(attempt) as max_attempt FROM workspaces WHERE task_id = ?`,
			)
			.get(taskId);

		return row?.max_attempt ?? 0;
	}

	upsert(workspace: Workspace): void {
		this.db
			.query(
				`INSERT INTO workspaces (id, task_id, container_ref, branch, worktree_path, setup_complete, attempt, archived, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           container_ref = excluded.container_ref,
           branch = excluded.branch,
           worktree_path = excluded.worktree_path,
           setup_complete = excluded.setup_complete,
           attempt = excluded.attempt,
           archived = excluded.archived,
           updated_at = excluded.updated_at`,
			)
			.run(
				workspace.id,
				workspace.taskId,
				workspace.containerRef,
				workspace.branch,
				workspace.worktreePath,
				workspace.setupComplete ? 1 : 0,
				workspace.attempt,
				workspace.archived ? 1 : 0,
				dateToSQL(workspace.createdAt),
				dateToSQL(workspace.updatedAt),
			);
	}

	delete(spec: Workspace.Spec): number {
		const where = compToSQL(
			spec,
			workspaceSpecToSQL as (s: unknown) => SQLFragment,
		);
		const result = this.db
			.query<{ changes: number }, SQLQueryBindings[]>(
				`DELETE FROM workspaces WHERE ${where.query}`,
			)
			.run(...(where.params as SQLQueryBindings[]));

		return result.changes;
	}

	private columnName(key: Workspace.SortKey): string {
		const map: Record<Workspace.SortKey, string> = {
			createdAt: "created_at",
			updatedAt: "updated_at",
			id: "id",
		};
		return map[key];
	}
}
