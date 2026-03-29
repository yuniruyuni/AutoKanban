import type { Cursor, Page } from "../../models/common";
import type { WorkspaceRepo } from "../../models/workspace-repo";

export interface IWorkspaceRepoRepository {
	get(spec: WorkspaceRepo.Spec): WorkspaceRepo | null;
	list(
		spec: WorkspaceRepo.Spec,
		cursor: Cursor<WorkspaceRepo.SortKey>,
	): Page<WorkspaceRepo>;
	listByWorkspace(workspaceId: string): WorkspaceRepo[];
	upsert(workspaceRepo: WorkspaceRepo): void;
	delete(spec: WorkspaceRepo.Spec): number;
}
