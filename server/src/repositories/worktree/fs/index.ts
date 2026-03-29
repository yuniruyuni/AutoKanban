import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import type { Project } from "../../../models/project";
import type { Workspace } from "../../../models/workspace";
import type { WorktreeInfo } from "../../../models/worktree-info";
import type { ILogger } from "../../../types/logger";
import { GitRepository } from "../../git/cli";
import type { IWorktreeRepository } from "../repository";

const WORKTREE_BASE_DIR = ".auto-kanban/worktrees";

/**
 * Repository for managing git worktrees for workspaces.
 *
 * Worktree path structure:
 * ~/.auto-kanban/worktrees/{workspaceId}/{projectName}/
 */
export class WorktreeRepository implements IWorktreeRepository {
	private gitRepository: GitRepository;
	private baseDir: string;
	private logger: ILogger;

	constructor(logger: ILogger, baseDir?: string) {
		this.logger = logger.child("WorktreeRepository");
		this.gitRepository = new GitRepository();
		this.baseDir = baseDir ?? path.join(os.homedir(), WORKTREE_BASE_DIR);
	}

	getBaseDir(): string {
		return this.baseDir;
	}

	getWorkspaceDir(workspaceId: string): string {
		return path.join(this.baseDir, workspaceId);
	}

	getWorktreePath(workspaceId: string, projectName: string): string {
		return path.join(this.getWorkspaceDir(workspaceId), projectName);
	}

	async createWorktree(
		workspace: Workspace,
		project: Project,
		targetBranch?: string,
	): Promise<string> {
		const worktreePath = this.getWorktreePath(workspace.id, project.name);
		const branch = workspace.branch;

		await fs.mkdir(path.dirname(worktreePath), { recursive: true });

		const branchExists = await this.gitRepository.branchExists(
			project.repoPath,
			branch,
		);

		const startPoint = targetBranch ?? project.branch ?? "HEAD";

		await this.gitRepository.addWorktree(
			project.repoPath,
			worktreePath,
			branch,
			!branchExists,
			startPoint,
		);

		return worktreePath;
	}

	async removeWorktree(
		workspaceId: string,
		project: Project,
		force: boolean = false,
		deleteBranch: boolean = true,
	): Promise<void> {
		const worktreePath = this.getWorktreePath(workspaceId, project.name);

		try {
			await fs.access(worktreePath);
		} catch {
			return;
		}

		let branch: string | null = null;
		try {
			branch = await this.gitRepository.getCurrentBranch(worktreePath);
		} catch {
			// Ignore - branch info unavailable
		}

		await this.gitRepository.removeWorktree(
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

		await this.cleanupEmptyDirs(workspaceId);
	}

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

		const workspaceDir = this.getWorkspaceDir(workspaceId);
		try {
			await fs.rm(workspaceDir, { recursive: true, force: true });
		} catch {
			// Ignore errors
		}
	}

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

	async pruneWorktrees(project: Project): Promise<void> {
		await this.gitRepository.pruneWorktrees(project.repoPath);
	}
}
