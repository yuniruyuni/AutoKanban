import type { Project } from "../../models/project";
import type { Workspace } from "../../models/workspace";
import type { WorktreeInfo } from "../../models/worktree-info";
import type { ServiceCtx } from "../../types/db-capability";

export interface WorktreeRepository {
	getBaseDir(ctx: ServiceCtx): string;
	getWorkspaceDir(ctx: ServiceCtx, workspaceId: string): string;
	getWorktreePath(
		ctx: ServiceCtx,
		workspaceId: string,
		projectName: string,
	): string;
	createWorktree(
		ctx: ServiceCtx,
		workspace: Workspace,
		project: Project,
		targetBranch?: string,
	): Promise<string>;
	removeWorktree(
		ctx: ServiceCtx,
		workspaceId: string,
		project: Project,
		force?: boolean,
		deleteBranch?: boolean,
	): Promise<void>;
	removeAllWorktrees(
		ctx: ServiceCtx,
		workspaceId: string,
		projects: Project[],
		force?: boolean,
		deleteBranch?: boolean,
	): Promise<void>;
	worktreeExists(
		ctx: ServiceCtx,
		workspaceId: string,
		projectName: string,
	): Promise<boolean>;
	ensureWorktreeExists(
		ctx: ServiceCtx,
		workspace: Workspace,
		project: Project,
		targetBranch?: string,
	): Promise<string>;
	getWorktreeInfo(
		ctx: ServiceCtx,
		workspaceId: string,
		projects: Project[],
	): Promise<WorktreeInfo[]>;
	pruneWorktrees(ctx: ServiceCtx, project: Project): Promise<void>;
}
