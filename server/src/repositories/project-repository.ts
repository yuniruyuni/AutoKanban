import type { Database, SQLQueryBindings } from "bun:sqlite";
import type { Cursor, Page } from "../models/common";
import { Project, type ProjectWithStats } from "../models/project";
import type { IProjectRepository } from "../types/repository";
import { compToSQL, dateFromSQL, dateToSQL } from "./common";
import { type SQLFragment, sql } from "./sql";

// ============================================
// Row type
// ============================================

interface ProjectRow {
	id: string;
	name: string;
	description: string | null;
	repo_path: string;
	branch: string;
	setup_script: string | null;
	cleanup_script: string | null;
	dev_server_script: string | null;
	created_at: string;
	updated_at: string;
}

interface ProjectWithStatsRow extends ProjectRow {
	todo_count: number;
	inprogress_count: number;
	inreview_count: number;
	done_count: number;
	cancelled_count: number;
}

// ============================================
// Spec to SQL converter
// ============================================

type ProjectSpecData =
	| { type: "ById"; id: string }
	| { type: "ByName"; name: string }
	| { type: "ByRepoPath"; repoPath: string }
	| { type: "All" };

function projectSpecToSQL(spec: ProjectSpecData): SQLFragment {
	switch (spec.type) {
		case "ById":
			return sql`id = ${spec.id}`;
		case "ByName":
			return sql`name = ${spec.name}`;
		case "ByRepoPath":
			return sql`repo_path = ${spec.repoPath}`;
		case "All":
			return sql`1 = 1`;
	}
}

// ============================================
// Row to Entity converter
// ============================================

function rowToProject(row: ProjectRow): Project {
	return {
		id: row.id,
		name: row.name,
		description: row.description,
		repoPath: row.repo_path,
		branch: row.branch,
		setupScript: row.setup_script,
		cleanupScript: row.cleanup_script,
		devServerScript: row.dev_server_script,
		createdAt: dateFromSQL(row.created_at),
		updatedAt: dateFromSQL(row.updated_at),
	};
}

function rowToProjectWithStats(row: ProjectWithStatsRow): ProjectWithStats {
	return {
		...rowToProject(row),
		taskStats: {
			todo: row.todo_count,
			inProgress: row.inprogress_count,
			inReview: row.inreview_count,
			done: row.done_count,
			cancelled: row.cancelled_count,
		},
	};
}

// ============================================
// Project Repository
// ============================================

export class ProjectRepository implements IProjectRepository {
	constructor(private db: Database) {}

	get(spec: Project.Spec): Project | null {
		const where = compToSQL(
			spec,
			projectSpecToSQL as (s: unknown) => SQLFragment,
		);
		const row = this.db
			.query<ProjectRow, SQLQueryBindings[]>(
				`SELECT * FROM projects WHERE ${where.query} LIMIT 1`,
			)
			.get(...(where.params as SQLQueryBindings[]));

		return row ? rowToProject(row) : null;
	}

	list(spec: Project.Spec, cursor: Cursor<Project.SortKey>): Page<Project> {
		const where = compToSQL(
			spec,
			projectSpecToSQL as (s: unknown) => SQLFragment,
		);

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
			.query<ProjectRow, SQLQueryBindings[]>(
				`SELECT * FROM projects WHERE ${where.query} ORDER BY ${orderBy} LIMIT ${limit}`,
			)
			.all(...(where.params as SQLQueryBindings[]));

		const hasMore = rows.length > cursor.limit;
		const items = rows.slice(0, cursor.limit).map(rowToProject);

		const lastItem = items[items.length - 1];
		const nextCursor =
			hasMore && lastItem ? Project.cursor(lastItem, sort.keys) : undefined;

		return { items, hasMore, nextCursor };
	}

	listAll(): Project[] {
		const rows = this.db
			.query<ProjectRow, []>("SELECT * FROM projects ORDER BY created_at DESC")
			.all();

		return rows.map(rowToProject);
	}

	listAllWithStats(): ProjectWithStats[] {
		const rows = this.db
			.query<ProjectWithStatsRow, []>(`
        SELECT
          p.*,
          COALESCE(SUM(CASE WHEN t.status = 'todo' THEN 1 ELSE 0 END), 0) as todo_count,
          COALESCE(SUM(CASE WHEN t.status = 'inprogress' THEN 1 ELSE 0 END), 0) as inprogress_count,
          COALESCE(SUM(CASE WHEN t.status = 'inreview' THEN 1 ELSE 0 END), 0) as inreview_count,
          COALESCE(SUM(CASE WHEN t.status = 'done' THEN 1 ELSE 0 END), 0) as done_count,
          COALESCE(SUM(CASE WHEN t.status = 'cancelled' THEN 1 ELSE 0 END), 0) as cancelled_count
        FROM projects p
        LEFT JOIN tasks t ON t.project_id = p.id
        GROUP BY p.id
        ORDER BY p.created_at DESC
      `)
			.all();

		return rows.map(rowToProjectWithStats);
	}

	getWithStats(projectId: string): ProjectWithStats | null {
		const row = this.db
			.query<ProjectWithStatsRow, [string]>(`
        SELECT
          p.*,
          COALESCE(SUM(CASE WHEN t.status = 'todo' THEN 1 ELSE 0 END), 0) as todo_count,
          COALESCE(SUM(CASE WHEN t.status = 'inprogress' THEN 1 ELSE 0 END), 0) as inprogress_count,
          COALESCE(SUM(CASE WHEN t.status = 'inreview' THEN 1 ELSE 0 END), 0) as inreview_count,
          COALESCE(SUM(CASE WHEN t.status = 'done' THEN 1 ELSE 0 END), 0) as done_count,
          COALESCE(SUM(CASE WHEN t.status = 'cancelled' THEN 1 ELSE 0 END), 0) as cancelled_count
        FROM projects p
        LEFT JOIN tasks t ON t.project_id = p.id
        WHERE p.id = ?
        GROUP BY p.id
      `)
			.get(projectId);

		return row ? rowToProjectWithStats(row) : null;
	}

	upsert(project: Project): void {
		this.db
			.query(
				`INSERT INTO projects (id, name, description, repo_path, branch, setup_script, cleanup_script, dev_server_script, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           name = excluded.name,
           description = excluded.description,
           repo_path = excluded.repo_path,
           branch = excluded.branch,
           setup_script = excluded.setup_script,
           cleanup_script = excluded.cleanup_script,
           dev_server_script = excluded.dev_server_script,
           updated_at = excluded.updated_at`,
			)
			.run(
				project.id,
				project.name,
				project.description,
				project.repoPath,
				project.branch,
				project.setupScript,
				project.cleanupScript,
				project.devServerScript,
				dateToSQL(project.createdAt),
				dateToSQL(project.updatedAt),
			);
	}

	delete(spec: Project.Spec): number {
		const where = compToSQL(
			spec,
			projectSpecToSQL as (s: unknown) => SQLFragment,
		);
		const result = this.db
			.query<{ changes: number }, SQLQueryBindings[]>(
				`DELETE FROM projects WHERE ${where.query}`,
			)
			.run(...(where.params as SQLQueryBindings[]));

		return result.changes;
	}

	private columnName(key: Project.SortKey): string {
		const map: Record<Project.SortKey, string> = {
			createdAt: "created_at",
			updatedAt: "updated_at",
			id: "id",
		};
		return map[key];
	}
}
