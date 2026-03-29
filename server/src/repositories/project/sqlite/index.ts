import type { Database } from "bun:sqlite";
import type { Cursor, Page } from "../../../models/common";
import type { Project, ProjectWithStats } from "../../../models/project";
import type { IProjectRepository } from "../repository";
import { del } from "./delete";
import { get } from "./get";
import { getWithStats } from "./get-with-stats";
import { list } from "./list";
import { listAll } from "./list-all";
import { listAllWithStats } from "./list-all-with-stats";
import { upsert } from "./upsert";

export class ProjectRepository implements IProjectRepository {
	constructor(private db: Database) {}

	async get(spec: Project.Spec): Promise<Project | null> {
		return get(this.db, spec);
	}

	async list(
		spec: Project.Spec,
		cursor: Cursor<Project.SortKey>,
	): Promise<Page<Project>> {
		return list(this.db, spec, cursor);
	}

	async listAll(): Promise<Project[]> {
		return listAll(this.db);
	}

	async listAllWithStats(): Promise<ProjectWithStats[]> {
		return listAllWithStats(this.db);
	}

	async getWithStats(projectId: string): Promise<ProjectWithStats | null> {
		return getWithStats(this.db, projectId);
	}

	async upsert(project: Project): Promise<void> {
		upsert(this.db, project);
	}

	async delete(spec: Project.Spec): Promise<number> {
		return del(this.db, spec);
	}
}
