import type { Cursor, Page } from "../../../models/common";
import type { Project, ProjectWithStats } from "../../../models/project";
import type { DbReadCtx, DbWriteCtx } from "../../common";
import type { ProjectRepository as IProjectRepository } from "../repository";
import { del } from "./delete";
import { get } from "./get";
import { getWithStats } from "./get-with-stats";
import { list } from "./list";
import { listAll } from "./list-all";
import { listAllWithStats } from "./list-all-with-stats";
import { upsert } from "./upsert";

export class ProjectRepository implements IProjectRepository {
	async get(ctx: DbReadCtx, spec: Project.Spec): Promise<Project | null> {
		return get(ctx.db, spec);
	}

	async list(
		ctx: DbReadCtx,
		spec: Project.Spec,
		cursor: Cursor<Project.SortKey>,
	): Promise<Page<Project>> {
		return list(ctx.db, spec, cursor);
	}

	async listAll(ctx: DbReadCtx): Promise<Project[]> {
		return listAll(ctx.db);
	}

	async listAllWithStats(ctx: DbReadCtx): Promise<ProjectWithStats[]> {
		return listAllWithStats(ctx.db);
	}

	async getWithStats(
		ctx: DbReadCtx,
		projectId: string,
	): Promise<ProjectWithStats | null> {
		return getWithStats(ctx.db, projectId);
	}

	async upsert(ctx: DbWriteCtx, project: Project): Promise<void> {
		return upsert(ctx.db, project);
	}

	async delete(ctx: DbWriteCtx, spec: Project.Spec): Promise<number> {
		return del(ctx.db, spec);
	}
}
