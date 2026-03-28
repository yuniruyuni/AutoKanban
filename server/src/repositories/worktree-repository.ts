import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import type { Project } from "../models/project";
import type { Workspace } from "../models/workspace";
import type { WorktreeInfo } from "../models/worktree-info";
import type { ILogger } from "../types/logger";
import { GitRepository } from "./git-repository";

const WORKTREE_BASE_DIR = ".auto-kanban/worktrees";

/**
 * Repository for managing git worktrees for workspaces.
 *
 * Worktree path structure:
 * ~/.auto-kanban/worktrees/{workspaceId}/{projectName}/
 */
export class WorktreeRepository {
	private gitRepository: GitRepository;
	private baseDir: string;
	private logger: ILogger;

	constructor(logger: ILogger, baseDir?: string) {
		this.logger = logger.child("WorktreeRepository");
		this.gitRepository = new GitRepository();
		this.baseDir = baseDir ?? path.join(os.homedir(), WORKTREE_BASE_DIR);
	}

	/**
	 * Gets the base directory for all worktrees.
	 */
	getBaseDir(): string {
		return this.baseDir;
	}

	/**
	 * Gets the worktree directory for a specific workspace.
	 */
	getWorkspaceDir(workspaceId: string): string {
		return path.join(this.baseDir, workspaceId);
	}

	/**
	 * Gets the worktree path for a specific project in a workspace.
	 */
	getWorktreePath(workspaceId: string, projectName: string): string {
		return path.join(this.getWorkspaceDir(workspaceId), projectName);
	}

	/**
	 * Creates a worktree for a workspace and project.
	 * @param workspace - The workspace to create the worktree for
	 * @param project - The project (repository) to create the worktree from
	 * @param targetBranch - The base branch to create the worktree from (e.g., 'main')
	 */
	async createWorktree(
		workspace: Workspace,
		project: Project,
		targetBranch?: string,
	): Promise<string> {
		const worktreePath = this.getWorktreePath(workspace.id, project.name);
		const branch = workspace.branch;

		// Ensure parent directory exists
		await fs.mkdir(path.dirname(worktreePath), { recursive: true });

		// Check if branch already exists
		const branchExists = await this.gitRepository.branchExists(
			project.repoPath,
			branch,
		);

		// Use targetBranch as start point, or default to project's default branch
		const startPoint = targetBranch ?? project.branch ?? "HEAD";

		// Create worktree
		await this.gitRepository.addWorktree(
			project.repoPath,
			worktreePath,
			branch,
			!branchExists, // createBranch if it doesn't exist
			startPoint,
		);

		return worktreePath;
	}

	/**
	 * Removes a worktree for a workspace and project.
	 * @param deleteBranch - If true (default), also deletes the git branch after removing the worktree
	 */
	async removeWorktree(
		workspaceId: string,
		project: Project,
		force: boolean = false,
		deleteBranch: boolean = true,
	): Promise<void> {
		const worktreePath = this.getWorktreePath(workspaceId, project.name);

		// Check if worktree exists
		try {
			await fs.access(worktreePath);
		} catch {
			// Worktree doesn't exist, nothing to remove
			return;
		}

		// Get the branch name before removing the worktree
		let branch: string | null = null;
		try {
			branch = await this.gitRepository.getCurrentBranch(worktreePath);
		} catch {
			// Ignore - branch info unavailable
		}

		// Remove worktree
		await this.gitRepository.removeWorktree(
			project.repoPath,
			worktreePath,
			force,
		);

		// Delete the task branch (prevents stale context on re-execution)
		if (
			deleteBranch &&
			branch &&
			branch !== project.branch &&
			branch.startsWith("ak-")
		) {
			try {
				await this.gitRepository.deleteBranch(project.repoPath, branch, true);
			} catch (error) {
				this.logger.warn(
					`Failed to delete branch ${branch}: ${error}`,
				);
			}
		}

		// Clean up empty directories
		await this.cleanupEmptyDirs(workspaceId);
	}

	/**
	 * Removes all worktrees for a workspace.
	 */
	async removeAllWorktrees(
		workspaceId: string,
		projects: Project[],
		force: boolean = false,
		deleteBranch: boolean = true,
	): Promise<void> {
		for (const project of projects) {
			try {
				await this.removeWorktree(workspaceId, project, force, deleteBranch);
			} catch (error) {
				this.logger.error(
					`Failed to remove worktree for ${project.name}:`,
					error,
				);
			}
		}

		// Remove workspace directory
		const workspaceDir = this.getWorkspaceDir(workspaceId);
		try {
			await fs.rm(workspaceDir, { recursive: true, force: true });
		} catch {
			// Ignore errors
		}
	}

	/**
	 * Checks if a worktree exists.
	 */
	async worktreeExists(
		workspaceId: string,
		projectName: string,
	): Promise<boolean> {
		const worktreePath = this.getWorktreePath(workspaceId, projectName);
		try {
			await fs.access(worktreePath);
			return await this.gitRepository.isGitRepo(worktreePath);
		} catch {
			return false;
		}
	}

	/**
	 * Ensures a worktree exists, creating it if necessary.
	 * @param workspace - The workspace to create the worktree for
	 * @param project - The project (repository) to create the worktree from
	 * @param targetBranch - The base branch to create the worktree from (e.g., 'main')
	 */
	async ensureWorktreeExists(
		workspace: Workspace,
		project: Project,
		targetBranch?: string,
	): Promise<string> {
		const worktreePath = this.getWorktreePath(workspace.id, project.name);

		if (await this.worktreeExists(workspace.id, project.name)) {
			return worktreePath;
		}

		return await this.createWorktree(workspace, project, targetBranch);
	}

	/**
	 * Gets information about all worktrees in a workspace.
	 */
	async getWorktreeInfo(
		workspaceId: string,
		projects: Project[],
	): Promise<WorktreeInfo[]> {
		const result: WorktreeInfo[] = [];

		for (const project of projects) {
			const worktreePath = this.getWorktreePath(workspaceId, project.name);
			const exists = await this.worktreeExists(workspaceId, project.name);

			let branch = "";
			if (exists) {
				try {
					branch = await this.gitRepository.getCurrentBranch(worktreePath);
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

	/**
	 * Cleans up empty directories in a workspace.
	 */
	private async cleanupEmptyDirs(workspaceId: string): Promise<void> {
		const workspaceDir = this.getWorkspaceDir(workspaceId);

		try {
			const entries = await fs.readdir(workspaceDir);
			if (entries.length === 0) {
				await fs.rmdir(workspaceDir);
			}
		} catch {
			// Ignore errors
		}
	}

	/**
	 * Prunes stale worktree information for a project.
	 */
	async pruneWorktrees(project: Project): Promise<void> {
		await this.gitRepository.pruneWorktrees(project.repoPath);
	}
}
