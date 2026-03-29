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

	get(spec: Project.Spec): Project | null {
		return get(this.db, spec);
	}

	list(spec: Project.Spec, cursor: Cursor<Project.SortKey>): Page<Project> {
		return list(this.db, spec, cursor);
	}

	listAll(): Project[] {
		return listAll(this.db);
	}

	listAllWithStats(): ProjectWithStats[] {
		return listAllWithStats(this.db);
	}

	getWithStats(projectId: string): ProjectWithStats | null {
		return getWithStats(this.db, projectId);
	}

	upsert(project: Project): void {
		upsert(this.db, project);
	}

	delete(spec: Project.Spec): number {
		return del(this.db, spec);
	}
}
