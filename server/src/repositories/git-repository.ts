import * as fs from "node:fs/promises";
import * as path from "node:path";
import { spawn } from "bun";
import type { BranchStatus, ConflictOp } from "../models/branch-status";
import { createBranchStatus } from "../models/branch-status";
import type { GitDiff } from "../models/git-diff";

interface GitCommandResult {
	stdout: string;
	stderr: string;
	exitCode: number;
	success: boolean;
}

/**
 * Repository for executing git commands via CLI.
 */
export class GitRepository {
	/**
	 * Executes a git command in the specified working directory.
	 */
	private async exec(
		cwd: string,
		...args: string[]
	): Promise<GitCommandResult> {
		const proc = spawn(["git", ...args], {
			cwd,
			stdout: "pipe",
			stderr: "pipe",
		});

		const stdout = await new Response(proc.stdout).text();
		const stderr = await new Response(proc.stderr).text();
		const exitCode = await proc.exited;

		return {
			stdout: stdout.trim(),
			stderr: stderr.trim(),
			exitCode,
			success: exitCode === 0,
		};
	}

	// ============================================
	// Worktree Operations
	// ============================================

	/**
	 * Adds a new git worktree.
	 * @param repoPath - Path to the main git repository
	 * @param worktreePath - Path where the worktree will be created
	 * @param branch - Branch name to checkout or create
	 * @param createBranch - If true, creates a new branch from HEAD
	 * @param startPoint - Starting point for the new branch (default: HEAD)
	 */
	async addWorktree(
		repoPath: string,
		worktreePath: string,
		branch: string,
		createBranch: boolean = true,
		startPoint: string = "HEAD",
	): Promise<void> {
		const args = ["worktree", "add"];
		if (createBranch) {
			// Create new branch from startPoint: git worktree add -b <branch> <path> <start-point>
			args.push("-b", branch, worktreePath, startPoint);
		} else {
			// Checkout existing branch: git worktree add <path> <branch>
			args.push(worktreePath, branch);
		}

		const result = await this.exec(repoPath, ...args);
		if (!result.success) {
			throw new Error(`Failed to create worktree: ${result.stderr}`);
		}
	}

	/**
	 * Removes a git worktree.
	 */
	async removeWorktree(
		repoPath: string,
		worktreePath: string,
		force: boolean = false,
	): Promise<void> {
		const args = ["worktree", "remove"];
		if (force) {
			args.push("--force");
		}
		args.push(worktreePath);

		const result = await this.exec(repoPath, ...args);
		if (!result.success) {
			throw new Error(`Failed to remove worktree: ${result.stderr}`);
		}
	}

	/**
	 * Prunes stale worktree information.
	 */
	async pruneWorktrees(repoPath: string): Promise<void> {
		await this.exec(repoPath, "worktree", "prune");
	}

	// ============================================
	// Branch Operations
	// ============================================

	/**
	 * Gets the current branch name.
	 */
	async getCurrentBranch(worktreePath: string): Promise<string> {
		const result = await this.exec(
			worktreePath,
			"rev-parse",
			"--abbrev-ref",
			"HEAD",
		);
		if (!result.success) {
			throw new Error(`Failed to get current branch: ${result.stderr}`);
		}
		return result.stdout;
	}

	/**
	 * Deletes a local branch.
	 * @param force - If true, uses -D (force delete even if not merged)
	 */
	async deleteBranch(
		repoPath: string,
		branch: string,
		force: boolean = false,
	): Promise<void> {
		const flag = force ? "-D" : "-d";
		const result = await this.exec(repoPath, "branch", flag, branch);
		if (!result.success) {
			throw new Error(`Failed to delete branch ${branch}: ${result.stderr}`);
		}
	}

	/**
	 * Checks if a branch exists.
	 */
	async branchExists(repoPath: string, branch: string): Promise<boolean> {
		const result = await this.exec(
			repoPath,
			"show-ref",
			"--verify",
			`refs/heads/${branch}`,
		);
		return result.success;
	}

	/**
	 * Gets ahead/behind counts relative to another branch.
	 */
	async getAheadBehind(
		worktreePath: string,
		branch: string,
		targetBranch: string,
	): Promise<{ ahead: number; behind: number }> {
		const result = await this.exec(
			worktreePath,
			"rev-list",
			"--left-right",
			"--count",
			`${targetBranch}...${branch}`,
		);

		if (!result.success) {
			return { ahead: 0, behind: 0 };
		}

		const [behind, ahead] = result.stdout.split("\t").map(Number);
		return { ahead: ahead || 0, behind: behind || 0 };
	}

	// ============================================
	// Rebase/Merge Operations
	// ============================================

	/**
	 * Rebases current branch onto a new base.
	 */
	async rebaseBranch(
		worktreePath: string,
		newBase: string,
		oldBase?: string,
	): Promise<string> {
		const args = ["rebase"];
		if (oldBase) {
			args.push("--onto", newBase, oldBase);
		} else {
			args.push(newBase);
		}

		const result = await this.exec(worktreePath, ...args);
		if (!result.success) {
			// Check if it's a conflict
			if (await this.isRebaseInProgress(worktreePath)) {
				throw new Error("REBASE_CONFLICT");
			}
			throw new Error(`Rebase failed: ${result.stderr}`);
		}
		return result.stdout;
	}

	/**
	 * Fast-forward merges the current branch into the target branch.
	 * Updates targetBranch ref to point to HEAD without checkout.
	 */
	async fastForwardMerge(
		worktreePath: string,
		targetBranch: string,
	): Promise<void> {
		// Check if targetBranch is an ancestor of HEAD (ff possible)
		const check = await this.exec(
			worktreePath,
			"merge-base",
			"--is-ancestor",
			targetBranch,
			"HEAD",
		);
		if (!check.success) {
			throw new Error("FAST_FORWARD_NOT_POSSIBLE");
		}

		// Update targetBranch ref to HEAD
		const update = await this.exec(
			worktreePath,
			"update-ref",
			`refs/heads/${targetBranch}`,
			"HEAD",
		);
		if (!update.success) {
			throw new Error(`Failed to update ref: ${update.stderr}`);
		}
	}

	/**
	 * Aborts an in-progress rebase.
	 */
	async abortRebase(worktreePath: string): Promise<void> {
		const result = await this.exec(worktreePath, "rebase", "--abort");
		if (!result.success) {
			throw new Error(`Failed to abort rebase: ${result.stderr}`);
		}
	}

	/**
	 * Continues a rebase after conflicts are resolved.
	 */
	async continueRebase(worktreePath: string): Promise<void> {
		const result = await this.exec(worktreePath, "rebase", "--continue");
		if (!result.success) {
			throw new Error(`Failed to continue rebase: ${result.stderr}`);
		}
	}

	/**
	 * Aborts an in-progress merge.
	 */
	async abortMerge(worktreePath: string): Promise<void> {
		const result = await this.exec(worktreePath, "merge", "--abort");
		if (!result.success) {
			throw new Error(`Failed to abort merge: ${result.stderr}`);
		}
	}

	// ============================================
	// Conflict Detection
	// ============================================

	/**
	 * Checks if a rebase is in progress.
	 */
	async isRebaseInProgress(worktreePath: string): Promise<boolean> {
		const gitDir = await this.getGitDir(worktreePath);
		try {
			await fs.access(path.join(gitDir, "rebase-merge"));
			return true;
		} catch {
			try {
				await fs.access(path.join(gitDir, "rebase-apply"));
				return true;
			} catch {
				return false;
			}
		}
	}

	/**
	 * Checks if a merge is in progress.
	 */
	async isMergeInProgress(worktreePath: string): Promise<boolean> {
		const gitDir = await this.getGitDir(worktreePath);
		try {
			await fs.access(path.join(gitDir, "MERGE_HEAD"));
			return true;
		} catch {
			return false;
		}
	}

	/**
	 * Gets the list of files with conflicts.
	 */
	async getConflictedFiles(worktreePath: string): Promise<string[]> {
		const result = await this.exec(
			worktreePath,
			"diff",
			"--name-only",
			"--diff-filter=U",
		);

		if (!result.success || !result.stdout) {
			return [];
		}

		return result.stdout.split("\n").filter(Boolean);
	}

	/**
	 * Detects which conflict operation is in progress.
	 */
	async detectConflictOp(worktreePath: string): Promise<ConflictOp | null> {
		if (await this.isRebaseInProgress(worktreePath)) {
			return "rebase";
		}
		if (await this.isMergeInProgress(worktreePath)) {
			return "merge";
		}

		// Check for cherry-pick
		const gitDir = await this.getGitDir(worktreePath);
		try {
			await fs.access(path.join(gitDir, "CHERRY_PICK_HEAD"));
			return "cherryPick";
		} catch {
			// Check for revert
			try {
				await fs.access(path.join(gitDir, "REVERT_HEAD"));
				return "revert";
			} catch {
				return null;
			}
		}
	}

	// ============================================
	// Diff Operations
	// ============================================

	/**
	 * Gets file diffs compared to a base commit.
	 */
	async getDiffs(worktreePath: string, baseCommit: string): Promise<GitDiff[]> {
		const result = await this.exec(
			worktreePath,
			"diff",
			"--numstat",
			"--name-status",
			baseCommit,
		);

		if (!result.success) {
			return [];
		}

		// Parse numstat output
		const numstatResult = await this.exec(
			worktreePath,
			"diff",
			"--numstat",
			baseCommit,
		);

		const statusResult = await this.exec(
			worktreePath,
			"diff",
			"--name-status",
			baseCommit,
		);

		const numstatLines = numstatResult.stdout.split("\n").filter(Boolean);
		const statusLines = statusResult.stdout.split("\n").filter(Boolean);

		const diffs: GitDiff[] = [];

		for (let i = 0; i < statusLines.length; i++) {
			const statusLine = statusLines[i];
			const parts = statusLine.split("\t");
			const statusChar = parts[0][0];

			let status: GitDiff["status"];
			let filePath = parts[1];
			let oldPath: string | undefined;

			switch (statusChar) {
				case "A":
					status = "added";
					break;
				case "D":
					status = "deleted";
					break;
				case "R":
					status = "renamed";
					oldPath = parts[1];
					filePath = parts[2];
					break;
				default:
					status = "modified";
			}

			// Get additions/deletions from numstat
			const numstatLine = numstatLines[i];
			let additions = 0;
			let deletions = 0;

			if (numstatLine) {
				const [add, del] = numstatLine.split("\t");
				additions = add === "-" ? 0 : parseInt(add, 10);
				deletions = del === "-" ? 0 : parseInt(del, 10);
			}

			diffs.push({
				filePath,
				status,
				oldPath,
				additions,
				deletions,
			});
		}

		return diffs;
	}

	/**
	 * Gets unified diff compared to a base commit.
	 */
	async getUnifiedDiff(
		worktreePath: string,
		baseCommit: string,
	): Promise<string> {
		const result = await this.exec(worktreePath, "diff", baseCommit);
		return result.stdout;
	}

	/**
	 * Gets diff for a specific file.
	 */
	async getFileDiff(
		worktreePath: string,
		baseCommit: string,
		filePath: string,
	): Promise<string> {
		const result = await this.exec(
			worktreePath,
			"diff",
			baseCommit,
			"--",
			filePath,
		);
		return result.stdout;
	}

	// ============================================
	// Commit Operations
	// ============================================

	/**
	 * Gets the last commit info.
	 */
	async getLastCommit(
		worktreePath: string,
	): Promise<{ hash: string; message: string } | null> {
		const result = await this.exec(
			worktreePath,
			"log",
			"-1",
			"--format=%H%n%s",
		);

		if (!result.success || !result.stdout) {
			return null;
		}

		const [hash, message] = result.stdout.split("\n");
		return { hash, message };
	}

	/**
	 * Stages all changes.
	 */
	async stageAll(worktreePath: string): Promise<void> {
		await this.exec(worktreePath, "add", "-A");
	}

	/**
	 * Commits staged changes.
	 */
	async commit(worktreePath: string, message: string): Promise<void> {
		const result = await this.exec(worktreePath, "commit", "-m", message);
		if (!result.success) {
			throw new Error(`Commit failed: ${result.stderr}`);
		}
	}

	// ============================================
	// Push Operations
	// ============================================

	/**
	 * Pushes branch to remote.
	 */
	async push(
		worktreePath: string,
		remote: string = "origin",
		branch?: string,
		force: boolean = false,
	): Promise<void> {
		const args = ["push", remote];
		if (branch) {
			args.push(branch);
		}
		if (force) {
			args.push("--force");
		}

		const result = await this.exec(worktreePath, ...args);
		if (!result.success) {
			throw new Error(`Push failed: ${result.stderr}`);
		}
	}

	// ============================================
	// PR Operations
	// ============================================

	/**
	 * Executes a gh CLI command in the specified working directory.
	 */
	private async execGh(
		cwd: string,
		...args: string[]
	): Promise<GitCommandResult> {
		const proc = spawn(["gh", ...args], {
			cwd,
			stdout: "pipe",
			stderr: "pipe",
		});

		const stdout = await new Response(proc.stdout).text();
		const stderr = await new Response(proc.stderr).text();
		const exitCode = await proc.exited;

		return {
			stdout: stdout.trim(),
			stderr: stderr.trim(),
			exitCode,
			success: exitCode === 0,
		};
	}

	/**
	 * Creates a pull request using gh CLI.
	 */
	async createPullRequest(
		worktreePath: string,
		title: string,
		body: string,
		baseBranch: string,
		draft: boolean = false,
	): Promise<{ url: string }> {
		const args = [
			"pr",
			"create",
			"--title",
			title,
			"--body",
			body,
			"--base",
			baseBranch,
		];
		if (draft) {
			args.push("--draft");
		}

		const result = await this.execGh(worktreePath, ...args);
		if (!result.success) {
			throw new Error(`Failed to create pull request: ${result.stderr}`);
		}

		return { url: result.stdout };
	}

	// ============================================
	// PR Status
	// ============================================

	/**
	 * Gets PR status using gh CLI.
	 */
	async getPrStatus(
		repoPath: string,
		prUrl: string,
	): Promise<{
		state: "open" | "closed" | "merged";
		mergedAt: string | null;
	}> {
		const result = await this.execGh(
			repoPath,
			"pr",
			"view",
			prUrl,
			"--json",
			"state,mergedAt",
		);
		if (!result.success) {
			throw new Error(`Failed to get PR status: ${result.stderr}`);
		}

		const data = JSON.parse(result.stdout);
		const state = (data.state as string).toLowerCase() as
			| "open"
			| "closed"
			| "merged";
		return {
			state,
			mergedAt: data.mergedAt ?? null,
		};
	}

	/**
	 * Pulls a branch by fetching and updating the local ref.
	 */
	async pullBranch(
		repoPath: string,
		branch: string,
		remote: string = "origin",
	): Promise<void> {
		const fetchResult = await this.exec(repoPath, "fetch", remote, branch);
		if (!fetchResult.success) {
			throw new Error(`Failed to fetch branch: ${fetchResult.stderr}`);
		}

		const updateResult = await this.exec(
			repoPath,
			"update-ref",
			`refs/heads/${branch}`,
			`${remote}/${branch}`,
		);
		if (!updateResult.success) {
			throw new Error(`Failed to update ref: ${updateResult.stderr}`);
		}
	}

	// ============================================
	// Branch Status
	// ============================================

	/**
	 * Gets comprehensive branch status.
	 */
	async getBranchStatus(
		worktreePath: string,
		targetBranch: string,
	): Promise<BranchStatus> {
		const branch = await this.getCurrentBranch(worktreePath);
		const { ahead, behind } = await this.getAheadBehind(
			worktreePath,
			branch,
			targetBranch,
		);
		const isRebaseInProgress = await this.isRebaseInProgress(worktreePath);
		const isMergeInProgress = await this.isMergeInProgress(worktreePath);
		const conflictOp = await this.detectConflictOp(worktreePath);
		const conflictedFiles = await this.getConflictedFiles(worktreePath);
		const lastCommit = await this.getLastCommit(worktreePath);

		return createBranchStatus({
			branch,
			targetBranch,
			isRebaseInProgress,
			isMergeInProgress,
			conflictOp,
			conflictedFiles,
			ahead,
			behind,
			lastCommitHash: lastCommit?.hash ?? null,
			lastCommitMessage: lastCommit?.message ?? null,
		});
	}

	// ============================================
	// Helper Methods
	// ============================================

	/**
	 * Gets the .git directory path for a worktree.
	 */
	private async getGitDir(worktreePath: string): Promise<string> {
		const result = await this.exec(worktreePath, "rev-parse", "--git-dir");
		if (!result.success) {
			throw new Error(`Failed to get git dir: ${result.stderr}`);
		}

		const gitDir = result.stdout;
		if (path.isAbsolute(gitDir)) {
			return gitDir;
		}
		return path.join(worktreePath, gitDir);
	}

	/**
	 * Fetches from remote.
	 */
	async fetch(worktreePath: string, remote: string = "origin"): Promise<void> {
		await this.exec(worktreePath, "fetch", remote);
	}

	/**
	 * Checks if directory is a git repository.
	 */
	async isGitRepo(dirPath: string): Promise<boolean> {
		const result = await this.exec(dirPath, "rev-parse", "--git-dir");
		return result.success;
	}

	/**
	 * Lists all local branches in the repository.
	 */
	async listBranches(
		repoPath: string,
	): Promise<{ name: string; isCurrent: boolean }[]> {
		const currentBranch = await this.getCurrentBranch(repoPath).catch(() => "");

		const result = await this.exec(
			repoPath,
			"branch",
			"--format=%(refname:short)",
		);
		if (!result.success) {
			throw new Error(`Failed to list branches: ${result.stderr}`);
		}

		return result.stdout
			.split("\n")
			.filter(Boolean)
			.map((name) => ({
				name,
				isCurrent: name === currentBranch,
			}));
	}
}
