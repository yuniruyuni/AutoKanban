import type { Cursor, Page } from "../../models/common";
import type { Workspace } from "../../models/workspace";
import type { DbReadCtx, DbWriteCtx } from "../common";

export interface WorkspaceRepository {
	get(ctx: DbReadCtx, spec: Workspace.Spec): Promise<Workspace | null>;
	list(
		ctx: DbReadCtx,
		spec: Workspace.Spec,
		cursor: Cursor<Workspace.SortKey>,
	): Promise<Page<Workspace>>;
	findByWorktreePath(
		ctx: DbReadCtx,
		worktreePath: string,
	): Promise<Workspace | null>;
	getMaxAttempt(ctx: DbReadCtx, taskId: string): Promise<number>;
	upsert(ctx: DbWriteCtx, workspace: Workspace): Promise<void>;
	delete(ctx: DbWriteCtx, spec: Workspace.Spec): Promise<number>;
}
