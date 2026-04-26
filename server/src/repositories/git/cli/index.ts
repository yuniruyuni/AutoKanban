// @specre 01KQ46NA9PKBT5W133HP1R1BJP
// @specre 01KQ46NAA0F829KC90BEK8VW3H
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { spawn } from "bun";
import { KeyedLock } from "../../../infra/concurrency/keyed-lock";
import type { ILogger } from "../../../infra/logger/types";
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
	private logger: ILogger | null;

	// Per-repo serialization for operations that race on the parent repo's
	// `.git/index.lock` (notably `pullBranch` / `git merge --ff-only`).
	// Keyed by repoPath so independent repos still run in parallel. Static
	// so all GitRepository instances share the same map (we currently only
	// instantiate it twice — context.ts + WorktreeRepository — but they need
	// to coordinate on the same parent repo regardless).
	private static readonly repoLock = new KeyedLock();

	constructor(logger?: ILogger) {
		this.logger = logger ? logger.child("GitRepository") : null;
	}

	/**
	 * Resolve a base branch name to the freshest available ref.
	 *
	 * Prefers `<remote>/<branch>` (e.g. `origin/main`), which after a `fetch`
	 * points to the canonical tip of the base branch. Falls back to the local
	 * branch name when the remote-tracking ref does not exist (local-only
	 * repositories). This ensures rebase / diff / ahead-behind all reference
	 * the latest known state of the base branch rather than a possibly stale
	 * local ref that `git fetch origin` never updates.
	 */
	private async resolveBaseRef(
		worktreePath: string,
		branch: string,
		remote = "origin",
	): Promise<string> {
		const remoteRef = `${remote}/${branch}`;
		const result = await this.exec(
			worktreePath,
			"rev-parse",
			"--verify",
			"--quiet",
			`refs/remotes/${remoteRef}`,
		);
		return result.success ? remoteRef : branch;
	}

	/**
	 * Compute the fork-point commit to diff the worktree against.
	 *
	 * Returns `merge-base(<resolvedBase>, HEAD)` when available. Callers pass
	 * this single commit SHA (not a range) to `git diff` so the diff compares
	 * fork-point → WORKING TREE, which includes the typical agent-in-progress
	 * state (uncommitted edits). Using a range like `<base>...HEAD` instead
	 * would diff fork-point → HEAD only and silently drop uncommitted changes.
	 *
	 * Falls back to the resolved ref itself if merge-base fails — matches the
	 * pre-merge-base behaviour and stays non-empty for repositories without a
	 * common ancestor.
	 */
	private async resolveDiffBase(
		worktreePath: string,
		branch: string,
	): Promise<string> {
		const resolved = await this.resolveBaseRef(worktreePath, branch);
		const mb = await this.exec(worktreePath, "merge-base", resolved, "HEAD");
		return mb.success && mb.stdout ? mb.stdout : resolved;
	}

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
		const resolvedTarget = await this.resolveBaseRef(
			worktreePath,
			targetBranch,
		);
		const result = await this.exec(
			worktreePath,
			"rev-list",
			"--left-right",
			"--count",
			`${resolvedTarget}...${branch}`,
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
		// Snapshot pre-existing autostash entries so we can detect ones our
		// rebase creates but fails to pop (orphan stashes accumulate
		// silently otherwise — see the bf0a35c-era leak that motivated this).
		const stashesBefore = await this.listAutostashRefs(worktreePath);

		// Resolve to origin/<base> when available so rebase targets the freshly
		// fetched tip rather than the possibly stale local branch ref.
		const resolvedNewBase = await this.resolveBaseRef(worktreePath, newBase);
		const resolvedOldBase = oldBase
			? await this.resolveBaseRef(worktreePath, oldBase)
			: undefined;

		// Auto-stash uncommitted changes to allow rebase on dirty worktree
		const args = ["rebase", "--autostash"];
		if (resolvedOldBase) {
			args.push("--onto", resolvedNewBase, resolvedOldBase);
		} else {
			args.push(resolvedNewBase);
		}

		const result = await this.exec(worktreePath, ...args);
		if (!result.success) {
			if (await this.isRebaseInProgress(_ctx, worktreePath)) {
				// Conflict — rebase is paused mid-replay. The autostash is
				// expected to remain in the list until --continue or --abort
				// runs, so don't flag it as orphaned yet.
				throw new Error("REBASE_CONFLICT");
			}
			await this.warnIfOrphanAutostash(worktreePath, stashesBefore, "rebase");
			throw new Error(`Rebase failed: ${result.stderr}`);
		}
		// Success path: the autostash should have been popped. If not, the
		// pop hit a conflict and silently left the entry behind.
		await this.warnIfOrphanAutostash(worktreePath, stashesBefore, "rebase");
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
		const stashesBefore = await this.listAutostashRefs(worktreePath);
		const result = await this.exec(worktreePath, "rebase", "--abort");
		if (!result.success) {
			throw new Error(`Failed to abort rebase: ${result.stderr}`);
		}
		// `git rebase --abort` re-applies the autostash. If apply hit a
		// conflict the entry stays — surface that so it doesn't silently
		// pile up as it did with the bf0a35c-era leftovers.
		await this.warnIfOrphanAutostash(
			worktreePath,
			stashesBefore,
			"rebase --abort",
		);
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
		// Single-arg `git diff <mergeBase>` compares fork-point → WORKING TREE,
		// which catches both committed changes unique to the task and any
		// uncommitted edits the agent has in flight. Using `<base>...HEAD` (a
		// range) would scope to committed-only and hide work-in-progress.
		const base = await this.resolveDiffBase(worktreePath, baseCommit);

		const result = await this.exec(
			worktreePath,
			"diff",
			"--numstat",
			"--name-status",
			base,
		);

		if (!result.success) {
			return [];
		}

		const numstatResult = await this.exec(
			worktreePath,
			"diff",
			"--numstat",
			base,
		);

		const statusResult = await this.exec(
			worktreePath,
			"diff",
			"--name-status",
			base,
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
		const base = await this.resolveDiffBase(worktreePath, baseCommit);
		const result = await this.exec(worktreePath, "diff", base);
		return result.stdout;
	}

	async getFileDiff(
		_ctx: ServiceCtx,
		worktreePath: string,
		baseCommit: string,
		filePath: string,
	): Promise<string> {
		const base = await this.resolveDiffBase(worktreePath, baseCommit);
		const result = await this.exec(worktreePath, "diff", base, "--", filePath);
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
		// Serialize on repoPath so two finalize-pr-merge runs racing on the
		// same parent repo don't trip over `.git/index.lock`. Different repos
		// stay parallel.
		return GitRepository.repoLock.runExclusive(repoPath, async () => {
			const fetchResult = await this.exec(repoPath, "fetch", remote, branch);
			if (!fetchResult.success) {
				throw new Error(`Failed to fetch branch: ${fetchResult.stderr}`);
			}

			// If the branch is checked out in any worktree (typically the
			// parent repo on `main`), advance it via fast-forward merge from
			// inside that worktree so the working tree files move forward
			// together with the ref. `git update-ref` alone only moves the
			// pointer and silently strands the working tree at the old
			// commit, surfacing every newly merged change as a reverse diff
			// in `git status`.
			const checkoutPath = await this.findWorktreeForBranch(repoPath, branch);
			if (checkoutPath) {
				const mergeResult = await this.exec(
					checkoutPath,
					"merge",
					"--ff-only",
					`${remote}/${branch}`,
				);
				if (!mergeResult.success) {
					throw new Error(
						`Failed to fast-forward ${branch} at ${checkoutPath}: ${mergeResult.stderr}`,
					);
				}
				return;
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
		});
	}

	private async findWorktreeForBranch(
		repoPath: string,
		branch: string,
	): Promise<string | null> {
		const result = await this.exec(repoPath, "worktree", "list", "--porcelain");
		if (!result.success) return null;
		return parseWorktreeForBranch(result.stdout, branch);
	}

	/**
	 * Return the SHAs of stash entries whose reflog subject is exactly
	 * "autostash" — the marker `git rebase --autostash` writes. SHAs (not
	 * `stash@{N}` indexes) are stable across `git stash drop` calls that
	 * renumber the index.
	 */
	private async listAutostashRefs(cwd: string): Promise<string[]> {
		const result = await this.exec(cwd, "stash", "list", "--format=%H %gs");
		if (!result.success) return [];
		return parseAutostashRefs(result.stdout);
	}

	private async warnIfOrphanAutostash(
		cwd: string,
		refsBefore: string[],
		op: string,
	): Promise<void> {
		if (!this.logger) return;
		const after = await this.listAutostashRefs(cwd);
		const before = new Set(refsBefore);
		const orphans = after.filter((sha) => !before.has(sha));
		if (orphans.length === 0) return;
		this.logger.warn(
			`${op} left ${orphans.length} orphan autostash ${
				orphans.length === 1 ? "entry" : "entries"
			} in ${cwd}: ${orphans.join(", ")}. Recover with: git stash apply <sha> && git stash drop <sha>`,
		);
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

// Parse `git worktree list --porcelain` output and return the absolute path
// of the worktree on `branch`, or null if not checked out anywhere. Each
// worktree entry is a block of `key value` lines (worktree, HEAD, branch)
// terminated by a blank line. Detached worktrees emit `detached` instead of
// `branch <ref>` and are ignored.
export function parseWorktreeForBranch(
	porcelain: string,
	branch: string,
): string | null {
	const target = `branch refs/heads/${branch}`;
	let currentPath: string | null = null;
	for (const line of porcelain.split("\n")) {
		if (line.startsWith("worktree ")) {
			currentPath = line.slice("worktree ".length);
		} else if (line === target && currentPath) {
			return currentPath;
		} else if (line === "") {
			currentPath = null;
		}
	}
	return null;
}

// Parse `git stash list --format=%H %gs` output and return SHAs of entries
// whose reflog subject is exactly "autostash" (the marker
// `git rebase --autostash` writes). Other stash subjects (e.g.
// `On main: <message>`, `WIP on main: ...`) are ignored.
export function parseAutostashRefs(stashList: string): string[] {
	const refs: string[] = [];
	for (const line of stashList.split("\n")) {
		const space = line.indexOf(" ");
		if (space === -1) continue;
		const subject = line.slice(space + 1);
		if (subject === "autostash") {
			refs.push(line.slice(0, space));
		}
	}
	return refs;
}
