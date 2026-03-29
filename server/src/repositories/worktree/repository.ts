import type { Project } from "../../models/project";
import type { Workspace } from "../../models/workspace";
import type { WorktreeInfo } from "../../models/worktree-info";

export interface IWorktreeRepository {
	getBaseDir(): string;
	getWorkspaceDir(workspaceId: string): string;
	getWorktreePath(workspaceId: string, projectName: string): string;
	createWorktree(
		workspace: Workspace,
		project: Project,
		targetBranch?: string,
	): Promise<string>;
	removeWorktree(
		workspaceId: string,
		project: Project,
		force?: boolean,
		deleteBranch?: boolean,
	): Promise<void>;
	removeAllWorktrees(
		workspaceId: string,
		projects: Project[],
		force?: boolean,
		deleteBranch?: boolean,
	): Promise<void>;
	worktreeExists(workspaceId: string, projectName: string): Promise<boolean>;
	ensureWorktreeExists(
		workspace: Workspace,
		project: Project,
		targetBranch?: string,
	): Promise<string>;
	getWorktreeInfo(
		workspaceId: string,
		projects: Project[],
	): Promise<WorktreeInfo[]>;
	pruneWorktrees(project: Project): Promise<void>;
}
