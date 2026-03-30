import type { Cursor, Page } from "../../models/common";
import type { WorkspaceRepo } from "../../models/workspace-repo";
import type { DbReadCtx, DbWriteCtx } from "../common";

export interface WorkspaceRepoRepository {
	get(ctx: DbReadCtx, spec: WorkspaceRepo.Spec): Promise<WorkspaceRepo | null>;
	list(
		ctx: DbReadCtx,
		spec: WorkspaceRepo.Spec,
		cursor: Cursor<WorkspaceRepo.SortKey>,
	): Promise<Page<WorkspaceRepo>>;
	listByWorkspace(
		ctx: DbReadCtx,
		workspaceId: string,
	): Promise<WorkspaceRepo[]>;
	upsert(ctx: DbWriteCtx, workspaceRepo: WorkspaceRepo): Promise<void>;
	delete(ctx: DbWriteCtx, spec: WorkspaceRepo.Spec): Promise<number>;
}
