// @specre 01KPQ6W85T6VTJEQWKM3BNVPMC
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import type { ILogger } from "../../../infra/logger/types";
import type { Project } from "../../../models/project";
import type { Workspace } from "../../../models/workspace";
import type { WorktreeInfo } from "../../../models/worktree-info";
import type { ServiceCtx } from "../../common";
import { GitRepository } from "../../git/cli";
import type { WorktreeRepository as WorktreeRepositoryDef } from "../repository";

const WORKTREE_BASE_DIR = ".auto-kanban/worktrees";

/**
 * Repository for managing git worktrees for workspaces.
 *
 * Worktree path structure:
 * ~/.auto-kanban/worktrees/{workspaceId}/{projectName}/
 */
export class WorktreeRepository implements WorktreeRepositoryDef {
	private gitRepository: GitRepository;
	private baseDir: string;
	private logger: ILogger;

	constructor(logger: ILogger, baseDir?: string) {
		this.logger = logger.child("WorktreeRepository");
		this.gitRepository = new GitRepository();
		this.baseDir = baseDir ?? path.join(os.homedir(), WORKTREE_BASE_DIR);
	}

	getBaseDir(_ctx: ServiceCtx): string {
		return this.baseDir;
	}

	getWorkspaceDir(_ctx: ServiceCtx, workspaceId: string): string {
		return path.join(this.baseDir, workspaceId);
	}

	getWorktreePath(
		_ctx: ServiceCtx,
		workspaceId: string,
		projectName: string,
	): string {
		const workspaceDir = this.getWorkspaceDir(_ctx, workspaceId);
		const joined = path.join(workspaceDir, projectName);
		const resolvedBase = path.resolve(workspaceDir);
		const resolved = path.resolve(joined);
		if (
			resolved !== resolvedBase &&
			!resolved.startsWith(resolvedBase + path.sep)
		) {
			throw new Error(
				`Invalid project name: "${projectName}" escapes worktree base directory`,
			);
		}
		return joined;
	}

	async createWorktree(
		_ctx: ServiceCtx,
		workspace: Workspace,
		project: Project,
		targetBranch?: string,
	): Promise<string> {
		const worktreePath = this.getWorktreePath(_ctx, workspace.id, project.name);
		const branch = workspace.branch;

		await fs.mkdir(path.dirname(worktreePath), { recursive: true });

		const branchExists = await this.gitRepository.branchExists(
			_ctx,
			project.repoPath,
			branch,
		);

		const startPoint = targetBranch ?? project.branch ?? "HEAD";

		await this.gitRepository.addWorktree(
			_ctx,
			project.repoPath,
			worktreePath,
			branch,
			!branchExists,
			startPoint,
		);

		return worktreePath;
	}

	async removeWorktree(
		_ctx: ServiceCtx,
		workspaceId: string,
		project: Project,
		force: boolean = false,
		deleteBranch: boolean = true,
	): Promise<void> {
		const worktreePath = this.getWorktreePath(_ctx, workspaceId, project.name);

		try {
			await fs.access(worktreePath);
		} catch {
			return;
		}

		let branch: string | null = null;
		try {
			branch = await this.gitRepository.getCurrentBranch(_ctx, worktreePath);
		} catch {
			// Ignore - branch info unavailable
		}

		await this.gitRepository.removeWorktree(
			_ctx,
			project.repoPath,
			worktreePath,
			force,
		);

		if (
			deleteBranch &&
			branch &&
			branch !== project.branch &&
			branch.startsWith("ak-")
		) {
			try {
				await this.gitRepository.deleteBranch(project.repoPath, branch, true);
			} catch (error) {
				this.logger.warn(`Failed to delete branch ${branch}: ${error}`);
			}
		}

		await this.cleanupEmptyDirs(_ctx, workspaceId);
	}

	async removeAllWorktrees(
		_ctx: ServiceCtx,
		workspaceId: string,
		projects: Project[],
		force: boolean = false,
		deleteBranch: boolean = true,
	): Promise<void> {
		for (const project of projects) {
			try {
				await this.removeWorktree(
					_ctx,
					workspaceId,
					project,
					force,
					deleteBranch,
				);
			} catch (error) {
				this.logger.error(
					`Failed to remove worktree for ${project.name}:`,
					error,
				);
			}
		}

		const workspaceDir = this.getWorkspaceDir(_ctx, workspaceId);
		try {
			await fs.rm(workspaceDir, { recursive: true, force: true });
		} catch {
			// Ignore errors
		}
	}

	async worktreeExists(
		_ctx: ServiceCtx,
		workspaceId: string,
		projectName: string,
	): Promise<boolean> {
		const worktreePath = this.getWorktreePath(_ctx, workspaceId, projectName);
		try {
			await fs.access(worktreePath);
			return await this.gitRepository.isGitRepo(_ctx, worktreePath);
		} catch {
			return false;
		}
	}

	async ensureWorktreeExists(
		_ctx: ServiceCtx,
		workspace: Workspace,
		project: Project,
		targetBranch?: string,
	): Promise<string> {
		const worktreePath = this.getWorktreePath(_ctx, workspace.id, project.name);

		if (await this.worktreeExists(_ctx, workspace.id, project.name)) {
			return worktreePath;
		}

		return await this.createWorktree(_ctx, workspace, project, targetBranch);
	}

	async getWorktreeInfo(
		_ctx: ServiceCtx,
		workspaceId: string,
		projects: Project[],
	): Promise<WorktreeInfo[]> {
		const result: WorktreeInfo[] = [];

		for (const project of projects) {
			const worktreePath = this.getWorktreePath(
				_ctx,
				workspaceId,
				project.name,
			);
			const exists = await this.worktreeExists(_ctx, workspaceId, project.name);

			let branch = "";
			if (exists) {
				try {
					branch = await this.gitRepository.getCurrentBranch(
						_ctx,
						worktreePath,
					);
				} catch {
					// Ignore errors
				}
			}

			result.push({
				projectId: project.id,
				projectName: project.name,
				worktreePath,
				branch,
				exists,
			});
		}

		return result;
	}

	private async cleanupEmptyDirs(
		_ctx: ServiceCtx,
		workspaceId: string,
	): Promise<void> {
		const workspaceDir = this.getWorkspaceDir(_ctx, workspaceId);

		try {
			const entries = await fs.readdir(workspaceDir);
			if (entries.length === 0) {
				await fs.rmdir(workspaceDir);
			}
		} catch {
			// Ignore errors
		}
	}

	async pruneWorktrees(_ctx: ServiceCtx, project: Project): Promise<void> {
		await this.gitRepository.pruneWorktrees(_ctx, project.repoPath);
	}
}
