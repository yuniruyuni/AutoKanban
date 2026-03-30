import { type SQLFragment, sql } from "../../../infra/db/sql";
import { dateFromSQL } from "../../../infra/db/sql-helpers";
import type { Workspace } from "../../../models/workspace";

export interface WorkspaceRow {
	id: string;
	task_id: string;
	container_ref: string;
	branch: string;
	worktree_path: string | null;
	setup_complete: boolean;
	attempt: number;
	archived: boolean;
	created_at: Date;
	updated_at: Date;
}

type WorkspaceSpecData =
	| { type: "ById"; id: string }
	| { type: "ByTaskId"; taskId: string }
	| { type: "ByTaskIdActive"; taskId: string };

export function workspaceSpecToSQL(spec: WorkspaceSpecData): SQLFragment {
	switch (spec.type) {
		case "ById":
			return sql`id = ${spec.id}`;
		case "ByTaskId":
			return sql`task_id = ${spec.taskId}`;
		case "ByTaskIdActive":
			return sql`task_id = ${spec.taskId} AND archived = false`;
	}
}

export function rowToWorkspace(row: WorkspaceRow): Workspace {
	return {
		id: row.id,
		taskId: row.task_id,
		containerRef: row.container_ref,
		branch: row.branch,
		worktreePath: row.worktree_path,
		setupComplete: row.setup_complete,
		attempt: row.attempt,
		archived: row.archived,
		createdAt: dateFromSQL(row.created_at),
		updatedAt: dateFromSQL(row.updated_at),
	};
}

export function columnName(key: Workspace.SortKey): string {
	const map: Record<Workspace.SortKey, string> = {
		createdAt: "created_at",
		updatedAt: "updated_at",
		id: "id",
	};
	return map[key];
}
