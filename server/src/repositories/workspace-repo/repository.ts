import type { Cursor, Page } from "../../models/common";
import type { WorkspaceRepo } from "../../models/workspace-repo";

export interface IWorkspaceRepoRepository {
	get(spec: WorkspaceRepo.Spec): Promise<WorkspaceRepo | null>;
	list(
		spec: WorkspaceRepo.Spec,
		cursor: Cursor<WorkspaceRepo.SortKey>,
	): Promise<Page<WorkspaceRepo>>;
	listByWorkspace(workspaceId: string): Promise<WorkspaceRepo[]>;
	upsert(workspaceRepo: WorkspaceRepo): Promise<void>;
	delete(spec: WorkspaceRepo.Spec): Promise<number>;
}
