import type { Cursor, Page } from "../../models/common";
import type { Project, ProjectWithStats } from "../../models/project";
import type { DbReadCtx, DbWriteCtx } from "../../types/db-capability";

export interface ProjectRepository {
	get(ctx: DbReadCtx, spec: Project.Spec): Promise<Project | null>;
	list(
		ctx: DbReadCtx,
		spec: Project.Spec,
		cursor: Cursor<Project.SortKey>,
	): Promise<Page<Project>>;
	listAll(ctx: DbReadCtx): Promise<Project[]>;
	listAllWithStats(ctx: DbReadCtx): Promise<ProjectWithStats[]>;
	getWithStats(
		ctx: DbReadCtx,
		projectId: string,
	): Promise<ProjectWithStats | null>;
	upsert(ctx: DbWriteCtx, project: Project): Promise<void>;
	delete(ctx: DbWriteCtx, spec: Project.Spec): Promise<number>;
}
