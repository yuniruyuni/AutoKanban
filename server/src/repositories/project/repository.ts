import type { Cursor, Page } from "../../models/common";
import type { Project, ProjectWithStats } from "../../models/project";

export interface IProjectRepository {
	get(spec: Project.Spec): Project | null;
	list(spec: Project.Spec, cursor: Cursor<Project.SortKey>): Page<Project>;
	listAll(): Project[];
	listAllWithStats(): ProjectWithStats[];
	getWithStats(projectId: string): ProjectWithStats | null;
	upsert(project: Project): void;
	delete(spec: Project.Spec): number;
}
