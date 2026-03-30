import type { Cursor, Page } from "../../../models/common";
import type { WorkspaceRepo } from "../../../models/workspace-repo";
import type { DbReadCtx, DbWriteCtx } from "../../../types/db-capability";
import type { WorkspaceRepoRepository as IWorkspaceRepoRepository } from "../repository";
import { del } from "./delete";
import { get } from "./get";
import { list } from "./list";
import { listByWorkspace } from "./listByWorkspace";
import { upsert } from "./upsert";

export class WorkspaceRepoRepository implements IWorkspaceRepoRepository {
	async get(
		ctx: DbReadCtx,
		spec: WorkspaceRepo.Spec,
	): Promise<WorkspaceRepo | null> {
		return get(ctx.db, spec);
	}

	async list(
		ctx: DbReadCtx,
		spec: WorkspaceRepo.Spec,
		cursor: Cursor<WorkspaceRepo.SortKey>,
	): Promise<Page<WorkspaceRepo>> {
		return list(ctx.db, spec, cursor);
	}

	async listByWorkspace(
		ctx: DbReadCtx,
		workspaceId: string,
	): Promise<WorkspaceRepo[]> {
		return listByWorkspace(ctx.db, workspaceId);
	}

	async upsert(ctx: DbWriteCtx, workspaceRepo: WorkspaceRepo): Promise<void> {
		await upsert(ctx.db, workspaceRepo);
	}

	async delete(ctx: DbWriteCtx, spec: WorkspaceRepo.Spec): Promise<number> {
		return del(ctx.db, spec);
	}
}
