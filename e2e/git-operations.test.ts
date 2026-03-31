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
import { createTestClient, type TestClient } from "./helpers/client";
import {
	addFileAndCommit,
	cleanupTempRepos,
	createBranch,
	createTempGitRepo,
} from "./helpers/git";
import {
	resetTestData,
	setupTestServer,
	teardownTestServer,
} from "./helpers/server";

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

/** Helper: create project, task, start execution → returns IDs + worktree path */
async function setupWorkspace() {
	const repoPath = await createTempGitRepo();
	const project = await client.project.create.mutate({
		name: "GitProject",
		repoPath,
	});
	const task = await client.task.create.mutate({
		projectId: project.id,
		title: "Git operations task",
	});
	const exec = await client.execution.start.mutate({
		taskId: task.id,
	});
	return {
		repoPath,
		projectId: project.id,
		taskId: task.id,
		workspaceId: exec.workspaceId,
		worktreePath: exec.worktreePath,
	};
}

describe("git operations", () => {
	test("listBranches returns project branches", async () => {
		const repoPath = await createTempGitRepo();
		// Add extra branches to the repo
		await createBranch(repoPath, "feature-a");
		await createBranch(repoPath, "feature-b");

		const project = await client.project.create.mutate({
			name: "BranchProject",
			repoPath,
		});

		const { branches } = await client.git.listBranches.query({
			projectId: project.id,
		});

		const names = branches.map((b: { name: string }) => b.name);
		expect(names).toContain("main");
		expect(names).toContain("feature-a");
		expect(names).toContain("feature-b");
	});

	test("getDiffs shows changes in worktree", async () => {
		const { worktreePath, workspaceId, projectId } = await setupWorkspace();

		// Make changes in the worktree
		await writeFile(join(worktreePath, "new-file.txt"), "hello world\n");
		const proc = Bun.spawn(["git", "add", "new-file.txt"], {
			cwd: worktreePath,
			stdout: "ignore",
			stderr: "ignore",
		});
		await proc.exited;
		const commitProc = Bun.spawn(["git", "commit", "-m", "add new file"], {
			cwd: worktreePath,
			stdout: "ignore",
			stderr: "ignore",
		});
		await commitProc.exited;

		const result = await client.git.getDiffs.query({
			workspaceId,
			projectId,
		});

		expect(result.diffs.length).toBeGreaterThanOrEqual(1);
		expect(
			result.diffs.some(
				(d: { filePath: string }) => d.filePath === "new-file.txt",
			),
		).toBe(true);
		expect(result.totalAdditions).toBeGreaterThanOrEqual(1);
	});

	test("getBranchStatus shows ahead/behind counts", async () => {
		const { worktreePath, workspaceId, projectId } = await setupWorkspace();

		// Make a commit in the worktree
		await writeFile(join(worktreePath, "status-test.txt"), "content\n");
		const addProc = Bun.spawn(["git", "add", "status-test.txt"], {
			cwd: worktreePath,
			stdout: "ignore",
			stderr: "ignore",
		});
		await addProc.exited;
		const commitProc = Bun.spawn(
			["git", "commit", "-m", "status test commit"],
			{
				cwd: worktreePath,
				stdout: "ignore",
				stderr: "ignore",
			},
		);
		await commitProc.exited;

		const status = await client.git.getBranchStatus.query({
			workspaceId,
			projectId,
		});

		expect(status.ahead).toBeGreaterThanOrEqual(1);
	});

	test("rebase updates worktree branch onto new base", async () => {
		const { repoPath, worktreePath, workspaceId, projectId } =
			await setupWorkspace();

		// Add a commit on main in the original repo
		await addFileAndCommit(
			repoPath,
			"main-update.txt",
			"from main",
			"update on main",
		);

		// Add a commit in the worktree
		await writeFile(join(worktreePath, "feature.txt"), "feature work\n");
		const addProc = Bun.spawn(["git", "add", "feature.txt"], {
			cwd: worktreePath,
			stdout: "ignore",
			stderr: "ignore",
		});
		await addProc.exited;
		const commitProc = Bun.spawn(["git", "commit", "-m", "feature commit"], {
			cwd: worktreePath,
			stdout: "ignore",
			stderr: "ignore",
		});
		await commitProc.exited;

		// Rebase onto main
		const result = await client.git.rebase.mutate({
			workspaceId,
			projectId,
			newBaseBranch: "main",
		});

		expect(result.success).toBe(true);
		expect(result.hasConflicts).toBe(false);
	});

	test("rebase with conflicts reports conflicted files", async () => {
		const { repoPath, worktreePath, workspaceId, projectId } =
			await setupWorkspace();

		// Add same file with different content on main
		await addFileAndCommit(
			repoPath,
			"conflict.txt",
			"main content",
			"add conflict file on main",
		);

		// Add same file with different content in worktree
		await writeFile(join(worktreePath, "conflict.txt"), "worktree content\n");
		const addProc = Bun.spawn(["git", "add", "conflict.txt"], {
			cwd: worktreePath,
			stdout: "ignore",
			stderr: "ignore",
		});
		await addProc.exited;
		const commitProc = Bun.spawn(
			["git", "commit", "-m", "add conflict file in worktree"],
			{
				cwd: worktreePath,
				stdout: "ignore",
				stderr: "ignore",
			},
		);
		await commitProc.exited;

		// Rebase should detect conflict
		const result = await client.git.rebase.mutate({
			workspaceId,
			projectId,
			newBaseBranch: "main",
		});

		expect(result.hasConflicts).toBe(true);
		if ("conflictedFiles" in result) {
			expect(result.conflictedFiles.length).toBeGreaterThanOrEqual(1);
		}

		// Abort the rebase to clean up
		await client.git.abortRebase.mutate({
			workspaceId,
			projectId,
		});
	});

	test("merge (fast-forward) completes task", async () => {
		const { worktreePath, workspaceId, projectId, taskId } =
			await setupWorkspace();

		// Make a commit in worktree (so there's something to merge)
		await writeFile(join(worktreePath, "merge-test.txt"), "merge me\n");
		const addProc = Bun.spawn(["git", "add", "merge-test.txt"], {
			cwd: worktreePath,
			stdout: "ignore",
			stderr: "ignore",
		});
		await addProc.exited;
		const commitProc = Bun.spawn(["git", "commit", "-m", "merge test commit"], {
			cwd: worktreePath,
			stdout: "ignore",
			stderr: "ignore",
		});
		await commitProc.exited;

		// Merge into main (fast-forward)
		const result = await client.git.merge.mutate({
			workspaceId,
			projectId,
			targetBranch: "main",
		});

		expect(result.success).toBe(true);

		// Task should be marked as done
		const task = await client.task.get.query({ taskId });
		expect(task.status).toBe("done");
	});
});
