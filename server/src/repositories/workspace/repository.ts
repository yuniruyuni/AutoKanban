import type { Cursor, Page } from "../../models/common";
import type { Workspace } from "../../models/workspace";

export interface IWorkspaceRepository {
	get(spec: Workspace.Spec): Promise<Workspace | null>;
	list(
		spec: Workspace.Spec,
		cursor: Cursor<Workspace.SortKey>,
	): Promise<Page<Workspace>>;
	findByWorktreePath(worktreePath: string): Promise<Workspace | null>;
	getMaxAttempt(taskId: string): Promise<number>;
	upsert(workspace: Workspace): Promise<void>;
	delete(spec: Workspace.Spec): Promise<number>;
}
