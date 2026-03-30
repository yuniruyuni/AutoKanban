import * as fs from "node:fs/promises";
import * as path from "node:path";
import { spawn } from "bun";
import type { BranchStatus, ConflictOp } from "../../../models/branch-status";
import { createBranchStatus } from "../../../models/branch-status";
import type { GitDiff } from "../../../models/git-diff";
import type { ServiceCtx } from "../../common";
import type { GitRepository as GitRepositoryDef } from "../repository";

interface GitCommandResult {
	stdout: string;
	stderr: string;
	exitCode: number;
	success: boolean;
}

/**
 * Repository for executing git commands via CLI.
 */
export class GitRepository implements GitRepositoryDef {
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

	async addWorktree(
		_ctx: ServiceCtx,
		repoPath: string,
		worktreePath: string,
		branch: string,
		createBranch: boolean = true,
		startPoint: string = "HEAD",
	): Promise<void> {
		const args = ["worktree", "add"];
		if (createBranch) {
			args.push("-b", branch, worktreePath, startPoint);
		} else {
			args.push(worktreePath, branch);
		}

		const result = await this.exec(repoPath, ...args);
		if (!result.success) {
			throw new Error(`Failed to create worktree: ${result.stderr}`);
		}
	}

	async removeWorktree(
		_ctx: ServiceCtx,
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

	async pruneWorktrees(_ctx: ServiceCtx, repoPath: string): Promise<void> {
		await this.exec(repoPath, "worktree", "prune");
	}

	// ============================================
	// Branch Operations
	// ============================================

	async getCurrentBranch(
		_ctx: ServiceCtx,
		worktreePath: string,
	): Promise<string> {
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

	async branchExists(
		_ctx: ServiceCtx,
		repoPath: string,
		branch: string,
	): Promise<boolean> {
		const result = await this.exec(
			repoPath,
			"show-ref",
			"--verify",
			`refs/heads/${branch}`,
		);
		return result.success;
	}

	async getAheadBehind(
		_ctx: ServiceCtx,
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

	async listBranches(
		_ctx: ServiceCtx,
		repoPath: string,
	): Promise<{ name: string; isCurrent: boolean }[]> {
		const currentBranch = await this.getCurrentBranch(_ctx, repoPath).catch(
			() => "",
		);

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

	// ============================================
	// Rebase/Merge Operations
	// ============================================

	async rebaseBranch(
		_ctx: ServiceCtx,
		worktreePath: string,
		newBase: string,
		oldBase?: string,
	): Promise<string> {
		// Auto-stash uncommitted changes to allow rebase on dirty worktree
		const args = ["rebase", "--autostash"];
		if (oldBase) {
			args.push("--onto", newBase, oldBase);
		} else {
			args.push(newBase);
		}

		const result = await this.exec(worktreePath, ...args);
		if (!result.success) {
			if (await this.isRebaseInProgress(_ctx, worktreePath)) {
				throw new Error("REBASE_CONFLICT");
			}
			throw new Error(`Rebase failed: ${result.stderr}`);
		}
		return result.stdout;
	}

	async fastForwardMerge(
		_ctx: ServiceCtx,
		worktreePath: string,
		targetBranch: string,
	): Promise<void> {
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

	async abortRebase(_ctx: ServiceCtx, worktreePath: string): Promise<void> {
		const result = await this.exec(worktreePath, "rebase", "--abort");
		if (!result.success) {
			throw new Error(`Failed to abort rebase: ${result.stderr}`);
		}
	}

	async continueRebase(_ctx: ServiceCtx, worktreePath: string): Promise<void> {
		const result = await this.exec(worktreePath, "rebase", "--continue");
		if (!result.success) {
			throw new Error(`Failed to continue rebase: ${result.stderr}`);
		}
	}

	async abortMerge(_ctx: ServiceCtx, worktreePath: string): Promise<void> {
		const result = await this.exec(worktreePath, "merge", "--abort");
		if (!result.success) {
			throw new Error(`Failed to abort merge: ${result.stderr}`);
		}
	}

	// ============================================
	// Conflict Detection
	// ============================================

	async isRebaseInProgress(
		_ctx: ServiceCtx,
		worktreePath: string,
	): Promise<boolean> {
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

	async isMergeInProgress(
		_ctx: ServiceCtx,
		worktreePath: string,
	): Promise<boolean> {
		const gitDir = await this.getGitDir(worktreePath);
		try {
			await fs.access(path.join(gitDir, "MERGE_HEAD"));
			return true;
		} catch {
			return false;
		}
	}

	async getConflictedFiles(
		_ctx: ServiceCtx,
		worktreePath: string,
	): Promise<string[]> {
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

	async detectConflictOp(
		_ctx: ServiceCtx,
		worktreePath: string,
	): Promise<ConflictOp | null> {
		if (await this.isRebaseInProgress(_ctx, worktreePath)) {
			return "rebase";
		}
		if (await this.isMergeInProgress(_ctx, worktreePath)) {
			return "merge";
		}

		const gitDir = await this.getGitDir(worktreePath);
		try {
			await fs.access(path.join(gitDir, "CHERRY_PICK_HEAD"));
			return "cherryPick";
		} catch {
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

	async getDiffs(
		_ctx: ServiceCtx,
		worktreePath: string,
		baseCommit: string,
	): Promise<GitDiff[]> {
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

	async getUnifiedDiff(
		_ctx: ServiceCtx,
		worktreePath: string,
		baseCommit: string,
	): Promise<string> {
		const result = await this.exec(worktreePath, "diff", baseCommit);
		return result.stdout;
	}

	async getFileDiff(
		_ctx: ServiceCtx,
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

	async getLastCommit(
		_ctx: ServiceCtx,
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

	async stageAll(_ctx: ServiceCtx, worktreePath: string): Promise<void> {
		await this.exec(worktreePath, "add", "-A");
	}

	async commit(
		_ctx: ServiceCtx,
		worktreePath: string,
		message: string,
	): Promise<void> {
		const result = await this.exec(worktreePath, "commit", "-m", message);
		if (!result.success) {
			throw new Error(`Commit failed: ${result.stderr}`);
		}
	}

	// ============================================
	// Push Operations
	// ============================================

	async push(
		_ctx: ServiceCtx,
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

	async createPullRequest(
		_ctx: ServiceCtx,
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

	async getPrStatus(
		_ctx: ServiceCtx,
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

	async pullBranch(
		_ctx: ServiceCtx,
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

	async getBranchStatus(
		_ctx: ServiceCtx,
		worktreePath: string,
		targetBranch: string,
	): Promise<BranchStatus> {
		const branch = await this.getCurrentBranch(_ctx, worktreePath);
		const { ahead, behind } = await this.getAheadBehind(
			_ctx,
			worktreePath,
			branch,
			targetBranch,
		);
		const isRebaseInProgress = await this.isRebaseInProgress(
			_ctx,
			worktreePath,
		);
		const isMergeInProgress = await this.isMergeInProgress(_ctx, worktreePath);
		const conflictOp = await this.detectConflictOp(_ctx, worktreePath);
		const conflictedFiles = await this.getConflictedFiles(_ctx, worktreePath);
		const lastCommit = await this.getLastCommit(_ctx, worktreePath);

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

	async fetch(
		_ctx: ServiceCtx,
		worktreePath: string,
		remote: string = "origin",
	): Promise<void> {
		await this.exec(worktreePath, "fetch", remote);
	}

	async isGitRepo(_ctx: ServiceCtx, dirPath: string): Promise<boolean> {
		const result = await this.exec(dirPath, "rev-parse", "--git-dir");
		return result.success;
	}
}
