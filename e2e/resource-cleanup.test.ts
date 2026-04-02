import {
	afterAll,
	beforeAll,
	beforeEach,
	describe,
	expect,
	test,
} from "bun:test";
import { existsSync } from "node:fs";
import { createTestClient, type TestClient } from "./helpers/client";
import { cleanupTempRepos, createTempGitRepo } from "./helpers/git";
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

describe("resource cleanup", () => {
	test("deleting a project removes all its worktrees from filesystem", async () => {
		const repoPath = await createTempGitRepo();
		const project = await client.project.create.mutate({
			name: "CleanupProject",
			repoPath,
		});
		const task = await client.task.create.mutate({
			projectId: project.id,
			title: "Task with worktree",
		});

		// Start execution to create worktree
		const { worktreePath } = await client.execution.start.mutate({
			taskId: task.id,
		});

		expect(existsSync(worktreePath)).toBe(true);

		// Delete project with worktrees
		await client.project.delete.mutate({
			projectId: project.id,
			deleteWorktrees: true,
		});

		// Worktree should be gone
		expect(existsSync(worktreePath)).toBe(false);
	});

	test("deleting a task removes its specific worktree", async () => {
		const repoPath = await createTempGitRepo();
		const project = await client.project.create.mutate({
			name: "TaskCleanupProject",
			repoPath,
		});
		const task = await client.task.create.mutate({
			projectId: project.id,
			title: "Task to be deleted",
		});

		// Start execution to create worktree
		const { worktreePath, executionProcessId } =
			await client.execution.start.mutate({
				taskId: task.id,
			});

		expect(existsSync(worktreePath)).toBe(true);

		// Stop execution to unlock worktree
		await client.execution.stop.mutate({ executionProcessId });

		// Wait a bit to ensure process is stopped
		await new Promise((resolve) => setTimeout(resolve, 500));

		// Delete task with worktrees
		await client.task.delete.mutate({
			taskId: task.id,
			deleteWorktrees: true,
		});

		// Worktree should be gone
		expect(existsSync(worktreePath)).toBe(false);
	});
});
