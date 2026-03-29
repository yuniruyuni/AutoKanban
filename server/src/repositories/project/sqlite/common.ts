import { Project, type ProjectWithStats } from "../../../models/project";
import { dateFromSQL } from "../../common";
import { type SQLFragment, sql } from "../../sql";

export interface ProjectRow {
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

export interface ProjectWithStatsRow extends ProjectRow {
	todo_count: number;
	inprogress_count: number;
	inreview_count: number;
	done_count: number;
	cancelled_count: number;
}

type ProjectSpecData =
	| { type: "ById"; id: string }
	| { type: "ByName"; name: string }
	| { type: "ByRepoPath"; repoPath: string }
	| { type: "All" };

export function projectSpecToSQL(spec: ProjectSpecData): SQLFragment {
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

export function rowToProject(row: ProjectRow): Project {
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

export function rowToProjectWithStats(
	row: ProjectWithStatsRow,
): ProjectWithStats {
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

export function columnName(key: Project.SortKey): string {
	const map: Record<Project.SortKey, string> = {
		createdAt: "created_at",
		updatedAt: "updated_at",
		id: "id",
	};
	return map[key];
}
