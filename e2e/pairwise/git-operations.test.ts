import {
	afterAll,
	beforeAll,
	beforeEach,
	describe,
	expect,
	test,
} from "bun:test";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { TRPCClientError } from "@trpc/client";
import { createTestClient, type TestClient } from "../helpers/client";
import {
	addFileAndCommit,
	cleanupTempRepos,
	createTempGitRepo,
} from "../helpers/git";
import { parsePictTsv } from "../helpers/pict";
import {
	resetTestData,
	setupTestServer,
	teardownTestServer,
} from "../helpers/server";

interface GitOpsCase {
	Operation: string;
	WorktreeChanges: string;
	MainChanges: string;
}

const cases = parsePictTsv<GitOpsCase>("pict/git-operations.tsv");

let client: TestClient;

beforeAll(async () => {
	const { port } = await setupTestServer();
	client = createTestClient(port);
});

afterAll(() => {
	teardownTestServer();
	cleanupTempRepos();
});

beforeEach(async () => {
	await resetTestData();
});

function git(cwd: string, args: string[]): Promise<number> {
	return Bun.spawn(["git", ...args], {
		cwd,
		stdout: "ignore",
		stderr: "ignore",
	}).exited;
}

/** Set up git repo + worktree via execution.start, then apply changes */
async function setupGitState(
	c: GitOpsCase,
	client: TestClient,
): Promise<{
	repoPath: string;
	projectId: string;
	taskId: string;
	workspaceId: string;
	worktreePath: string;
}> {
	const repoPath = await createTempGitRepo();
	const project = await client.project.create.mutate({
		name: "GitOpsProject",
		repoPath,
	});
	const task = await client.task.create.mutate({
		projectId: project.id,
		title: "Git ops task",
	});
	const exec = await client.execution.start.mutate({ taskId: task.id });
	const { workspaceId, worktreePath } = exec;

	// Apply worktree changes (independent of MainChanges)
	if (c.WorktreeChanges === "committed_changes") {
		await writeFile(join(worktreePath, "worktree-change.txt"), "change\n");
		await git(worktreePath, ["add", "worktree-change.txt"]);
		await git(worktreePath, ["commit", "-m", "worktree change"]);
	}

	// Apply main branch changes
	if (c.MainChanges === "diverged_no_conflict") {
		await addFileAndCommit(
			repoPath,
			"main-only.txt",
			"main content",
			"main diverge",
		);
	} else if (c.MainChanges === "diverged_conflict") {
		// PICT constraint guarantees WorktreeChanges=committed_changes here.
		// Add conflicting file on main (worktree already has committed changes).
		await addFileAndCommit(
			repoPath,
			"worktree-change.txt",
			"main version of same file",
			"main conflict on same file",
		);
	}

	return {
		repoPath,
		projectId: project.id,
		taskId: task.id,
		workspaceId,
		worktreePath,
	};
}

describe("pairwise: git operations", () => {
	for (const c of cases) {
		const label = `${c.Operation} changes=${c.WorktreeChanges} main=${c.MainChanges}`;

		test(label, async () => {
			const { projectId, taskId, workspaceId } = await setupGitState(c, client);

			switch (c.Operation) {
				case "getDiffs": {
					const result = await client.git.getDiffs.query({
						workspaceId,
						projectId,
					});
					if (c.WorktreeChanges === "no_changes" && c.MainChanges === "none") {
						expect(result.diffs).toHaveLength(0);
						expect(result.totalAdditions).toBe(0);
					} else if (c.WorktreeChanges === "committed_changes") {
						// Worktree has commits → diffs should be non-empty
						expect(result.diffs.length).toBeGreaterThanOrEqual(1);
						expect(result.totalAdditions).toBeGreaterThanOrEqual(1);
					}
					break;
				}

				case "getBranchStatus": {
					const result = await client.git.getBranchStatus.query({
						workspaceId,
						projectId,
					});
					if (c.WorktreeChanges === "no_changes" && c.MainChanges === "none") {
						expect(result.ahead).toBe(0);
						expect(result.behind).toBe(0);
					}
					if (c.WorktreeChanges === "committed_changes") {
						expect(result.ahead).toBeGreaterThanOrEqual(1);
					}
					if (c.MainChanges.startsWith("diverged")) {
						expect(result.behind).toBeGreaterThanOrEqual(1);
					}
					break;
				}

				case "rebase": {
					const result = await client.git.rebase.mutate({
						workspaceId,
						projectId,
						newBaseBranch: "main",
					});
					if (c.MainChanges === "diverged_conflict") {
						expect(result.hasConflicts).toBe(true);
						// Abort to clean up
						await client.git.abortRebase.mutate({
							workspaceId,
							projectId,
						});
					} else {
						expect(result.success).toBe(true);
					}
					break;
				}

				case "merge": {
					if (c.MainChanges !== "none") {
						// Merge should fail (FF not possible when main has diverged)
						try {
							await client.git.merge.mutate({
								workspaceId,
								projectId,
								targetBranch: "main",
							});
							expect.unreachable("merge should fail");
						} catch (e) {
							expect(e).toBeInstanceOf(TRPCClientError);
						}
					} else {
						const result = await client.git.merge.mutate({
							workspaceId,
							projectId,
							targetBranch: "main",
						});
						expect(result.success).toBe(true);
						// Task should be done
						const task = await client.task.get.query({ taskId });
						expect(task.status).toBe("done");
					}
					break;
				}
			}
		});
	}
});
