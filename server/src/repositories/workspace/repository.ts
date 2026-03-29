import type { Cursor, Page } from "../../models/common";
import type { Workspace } from "../../models/workspace";

export interface IWorkspaceRepository {
	get(spec: Workspace.Spec): Workspace | null;
	list(
		spec: Workspace.Spec,
		cursor: Cursor<Workspace.SortKey>,
	): Page<Workspace>;
	findByWorktreePath(worktreePath: string): Workspace | null;
	getMaxAttempt(taskId: string): number;
	upsert(workspace: Workspace): void;
	delete(spec: Workspace.Spec): number;
}
