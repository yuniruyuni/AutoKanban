import { WorkspaceRepo } from "../../../models/workspace-repo";
import { dateFromSQL } from "../../common";
import { type SQLFragment, sql } from "../../sql";

export interface WorkspaceRepoRow {
	id: string;
	workspace_id: string;
	project_id: string;
	target_branch: string;
	pr_url: string | null;
	created_at: string;
	updated_at: string;
}

type WorkspaceRepoSpecData =
	| { type: "ById"; id: string }
	| { type: "ByWorkspaceId"; workspaceId: string }
	| { type: "ByProjectId"; projectId: string }
	| { type: "ByWorkspaceAndProject"; workspaceId: string; projectId: string };

export function workspaceRepoSpecToSQL(
	spec: WorkspaceRepoSpecData,
): SQLFragment {
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

export function rowToWorkspaceRepo(row: WorkspaceRepoRow): WorkspaceRepo {
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

export function columnName(key: WorkspaceRepo.SortKey): string {
	const map: Record<WorkspaceRepo.SortKey, string> = {
		createdAt: "created_at",
		updatedAt: "updated_at",
		id: "id",
	};
	return map[key];
}
