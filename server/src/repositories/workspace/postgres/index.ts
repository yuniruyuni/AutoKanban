import type { Cursor, Page } from "../../../models/common";
import type { Workspace } from "../../../models/workspace";
import type { DbReadCtx, DbWriteCtx } from "../../../types/db-capability";
import type { IWorkspaceRepositoryDef } from "../repository";
import { del } from "./delete";
import { findByWorktreePath } from "./find-by-worktree-path";
import { get } from "./get";
import { getMaxAttempt } from "./get-max-attempt";
import { list } from "./list";
import { upsert } from "./upsert";

export class WorkspaceRepository implements IWorkspaceRepositoryDef {
	async get(ctx: DbReadCtx, spec: Workspace.Spec): Promise<Workspace | null> {
		return get(ctx.db, spec);
	}

	async list(
		ctx: DbReadCtx,
		spec: Workspace.Spec,
		cursor: Cursor<Workspace.SortKey>,
	): Promise<Page<Workspace>> {
		return list(ctx.db, spec, cursor);
	}

	async findByWorktreePath(
		ctx: DbReadCtx,
		worktreePath: string,
	): Promise<Workspace | null> {
		return findByWorktreePath(ctx.db, worktreePath);
	}

	async getMaxAttempt(ctx: DbReadCtx, taskId: string): Promise<number> {
		return getMaxAttempt(ctx.db, taskId);
	}

	async upsert(ctx: DbWriteCtx, workspace: Workspace): Promise<void> {
		return upsert(ctx.db, workspace);
	}

	async delete(ctx: DbWriteCtx, spec: Workspace.Spec): Promise<number> {
		return del(ctx.db, spec);
	}
}
