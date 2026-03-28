import type { Database, SQLQueryBindings } from "bun:sqlite";
import type { Cursor, Page } from "../models/common";
import { WorkspaceRepo } from "../models/workspace-repo";
import type { IWorkspaceRepoRepository } from "../types/repository";
import { compToSQL, dateFromSQL, dateToSQL } from "./common";
import { type SQLFragment, sql } from "./sql";

// ============================================
// Row type
// ============================================

interface WorkspaceRepoRow {
	id: string;
	workspace_id: string;
	project_id: string;
	target_branch: string;
	pr_url: string | null;
	created_at: string;
	updated_at: string;
}

// ============================================
// Spec to SQL converter
// ============================================

type WorkspaceRepoSpecData =
	| { type: "ById"; id: string }
	| { type: "ByWorkspaceId"; workspaceId: string }
	| { type: "ByProjectId"; projectId: string }
	| { type: "ByWorkspaceAndProject"; workspaceId: string; projectId: string };

function workspaceRepoSpecToSQL(spec: WorkspaceRepoSpecData): SQLFragment {
	switch (spec.type) {
		case "ById":
			return sql`id = ${spec.id}`;
		case "ByWorkspaceId":
			return sql`workspace_id = ${spec.workspaceId}`;
		case "ByProjectId":
			return sql`project_id = ${spec.projectId}`;
		case "ByWorkspaceAndProject":
			return sql`workspace_id = ${spec.workspaceId} AND project_id = ${spec.projectId}`;
	}
}

// ============================================
// Row to Entity converter
// ============================================

function rowToWorkspaceRepo(row: WorkspaceRepoRow): WorkspaceRepo {
	return {
		id: row.id,
		workspaceId: row.workspace_id,
		projectId: row.project_id,
		targetBranch: row.target_branch,
		prUrl: row.pr_url,
		createdAt: dateFromSQL(row.created_at),
		updatedAt: dateFromSQL(row.updated_at),
	};
}

// ============================================
// WorkspaceRepo Repository
// ============================================

export class WorkspaceRepoRepository implements IWorkspaceRepoRepository {
	constructor(private db: Database) {}

	get(spec: WorkspaceRepo.Spec): WorkspaceRepo | null {
		const where = compToSQL(
			spec,
			workspaceRepoSpecToSQL as (s: unknown) => SQLFragment,
		);
		const row = this.db
			.query<WorkspaceRepoRow, SQLQueryBindings[]>(
				`SELECT * FROM workspace_repos WHERE ${where.query} LIMIT 1`,
			)
			.get(...(where.params as SQLQueryBindings[]));

		return row ? rowToWorkspaceRepo(row) : null;
	}

	list(
		spec: WorkspaceRepo.Spec,
		cursor: Cursor<WorkspaceRepo.SortKey>,
	): Page<WorkspaceRepo> {
		const where = compToSQL(
			spec,
			workspaceRepoSpecToSQL as (s: unknown) => SQLFragment,
		);

		// Build ORDER BY
		const sort = cursor.sort ?? {
			keys: ["createdAt", "id"] as const,
			order: "asc" as const,
		};
		const orderBy = sort.keys
			.map((k) => `${this.columnName(k)} ${sort.order.toUpperCase()}`)
			.join(", ");

		// Fetch one extra to determine hasMore
		const limit = cursor.limit + 1;

		const rows = this.db
			.query<WorkspaceRepoRow, SQLQueryBindings[]>(
				`SELECT * FROM workspace_repos WHERE ${where.query} ORDER BY ${orderBy} LIMIT ${limit}`,
			)
			.all(...(where.params as SQLQueryBindings[]));

		const hasMore = rows.length > cursor.limit;
		const items = rows.slice(0, cursor.limit).map(rowToWorkspaceRepo);

		const lastItem = items[items.length - 1];
		const nextCursor =
			hasMore && lastItem
				? WorkspaceRepo.cursor(lastItem, sort.keys)
				: undefined;

		return { items, hasMore, nextCursor };
	}

	listByWorkspace(workspaceId: string): WorkspaceRepo[] {
		const rows = this.db
			.query<WorkspaceRepoRow, [string]>(
				"SELECT * FROM workspace_repos WHERE workspace_id = ? ORDER BY created_at ASC",
			)
			.all(workspaceId);

		return rows.map(rowToWorkspaceRepo);
	}

	upsert(workspaceRepo: WorkspaceRepo): void {
		this.db
			.query(
				`INSERT INTO workspace_repos (id, workspace_id, project_id, target_branch, pr_url, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           target_branch = excluded.target_branch,
           pr_url = excluded.pr_url,
           updated_at = excluded.updated_at`,
			)
			.run(
				workspaceRepo.id,
				workspaceRepo.workspaceId,
				workspaceRepo.projectId,
				workspaceRepo.targetBranch,
				workspaceRepo.prUrl,
				dateToSQL(workspaceRepo.createdAt),
				dateToSQL(workspaceRepo.updatedAt),
			);
	}

	delete(spec: WorkspaceRepo.Spec): number {
		const where = compToSQL(
			spec,
			workspaceRepoSpecToSQL as (s: unknown) => SQLFragment,
		);
		const result = this.db
			.query<{ changes: number }, SQLQueryBindings[]>(
				`DELETE FROM workspace_repos WHERE ${where.query}`,
			)
			.run(...(where.params as SQLQueryBindings[]));

		return result.changes;
	}

	private columnName(key: WorkspaceRepo.SortKey): string {
		const map: Record<WorkspaceRepo.SortKey, string> = {
			createdAt: "created_at",
			updatedAt: "updated_at",
			id: "id",
		};
		return map[key];
	}
}
