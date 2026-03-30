import type { Project, ProjectWithStats } from "../../../models/project";
import { dateFromSQL } from "../../common";
import { type SQLFragment, sql } from "../../common";

export interface ProjectRow {
	id: string;
	name: string;
	description: string | null;
	repo_path: string;
	branch: string;
	created_at: Date;
	updated_at: Date;
}

export interface ProjectWithStatsRow extends ProjectRow {
	todo_count: string;
	inprogress_count: string;
	inreview_count: string;
	done_count: string;
	cancelled_count: string;
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
			todo: Number(row.todo_count),
			inProgress: Number(row.inprogress_count),
			inReview: Number(row.inreview_count),
			done: Number(row.done_count),
			cancelled: Number(row.cancelled_count),
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
