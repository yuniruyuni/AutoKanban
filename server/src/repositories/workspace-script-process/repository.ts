import type { Cursor, Page } from "../../models/common";
import type { WorkspaceScriptProcess } from "../../models/workspace-script-process";
import type { DbReadCtx, DbWriteCtx } from "../common";

export interface WorkspaceScriptProcessRepository {
	get(
		ctx: DbReadCtx,
		spec: WorkspaceScriptProcess.Spec,
	): Promise<WorkspaceScriptProcess | null>;
	list(
		ctx: DbReadCtx,
		spec: WorkspaceScriptProcess.Spec,
		cursor: Cursor<WorkspaceScriptProcess.SortKey>,
	): Promise<Page<WorkspaceScriptProcess>>;
	upsert(ctx: DbWriteCtx, process: WorkspaceScriptProcess): Promise<void>;
	delete(ctx: DbWriteCtx, spec: WorkspaceScriptProcess.Spec): Promise<number>;
}
