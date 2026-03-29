import type { Cursor, Page } from "../../models/common";
import type { Project, ProjectWithStats } from "../../models/project";

export interface IProjectRepository {
	get(spec: Project.Spec): Promise<Project | null>;
	list(
		spec: Project.Spec,
		cursor: Cursor<Project.SortKey>,
	): Promise<Page<Project>>;
	listAll(): Promise<Project[]>;
	listAllWithStats(): Promise<ProjectWithStats[]>;
	getWithStats(projectId: string): Promise<ProjectWithStats | null>;
	upsert(project: Project): Promise<void>;
	delete(spec: Project.Spec): Promise<number>;
}
