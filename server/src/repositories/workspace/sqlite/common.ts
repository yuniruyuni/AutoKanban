import type { Workspace } from "../../../models/workspace";
import { dateFromSQL } from "../../common";
import { type SQLFragment, sql } from "../../sql";

export interface WorkspaceRow {
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
			return sql`task_id = ${spec.taskId} AND archived = 0`;
	}
}

export function rowToWorkspace(row: WorkspaceRow): Workspace {
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

export function columnName(key: Workspace.SortKey): string {
	const map: Record<Workspace.SortKey, string> = {
		createdAt: "created_at",
		updatedAt: "updated_at",
		id: "id",
	};
	return map[key];
}
