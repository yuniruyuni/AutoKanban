import {
	afterAll,
	beforeAll,
	beforeEach,
	describe,
	expect,
	test,
} from "bun:test";
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

describe("task lifecycle", () => {
	test("full kanban flow: create project → tasks → move through statuses", async () => {
		const repoPath = await createTempGitRepo();
		const project = await client.project.create.mutate({
			name: "Lifecycle Project",
			repoPath,
		});

		// Create multiple tasks
		const task1 = await client.task.create.mutate({
			projectId: project.id,
			title: "Feature A",
		});
		const task2 = await client.task.create.mutate({
			projectId: project.id,
			title: "Feature B",
		});
		const task3 = await client.task.create.mutate({
			projectId: project.id,
			title: "Feature C",
		});

		// Move task1: todo → inprogress → inreview → done
		await client.task.update.mutate({
			taskId: task1.id,
			status: "inprogress",
		});
		await client.task.update.mutate({
			taskId: task1.id,
			status: "inreview",
		});
		await client.task.update.mutate({ taskId: task1.id, status: "done" });

		// Move task2: todo → inprogress
		await client.task.update.mutate({
			taskId: task2.id,
			status: "inprogress",
		});

		// Move task3: todo → cancelled
		await client.task.update.mutate({
			taskId: task3.id,
			status: "cancelled",
		});

		// Verify status counts via list queries
		const todoList = await client.task.list.query({
			projectId: project.id,
			status: "todo",
		});
		const inprogressList = await client.task.list.query({
			projectId: project.id,
			status: "inprogress",
		});
		const doneList = await client.task.list.query({
			projectId: project.id,
			status: "done",
		});
		const cancelledList = await client.task.list.query({
			projectId: project.id,
			status: "cancelled",
		});

		// Our manually created tasks (template tasks may also exist in todo)
		expect(inprogressList.items.some((t) => t.id === task2.id)).toBe(true);
		expect(doneList.items.some((t) => t.id === task1.id)).toBe(true);
		expect(cancelledList.items.some((t) => t.id === task3.id)).toBe(true);
		// task1, task2, task3 should NOT be in todo
		const ourIds = [task1.id, task2.id, task3.id];
		expect(todoList.items.filter((t) => ourIds.includes(t.id))).toHaveLength(0);
	});

	test("multiple projects with independent tasks", async () => {
		const repo1 = await createTempGitRepo();
		const repo2 = await createTempGitRepo();

		const project1 = await client.project.create.mutate({
			name: "Project 1",
			repoPath: repo1,
		});
		const project2 = await client.project.create.mutate({
			name: "Project 2",
			repoPath: repo2,
		});

		// Create tasks in different projects
		const t1 = await client.task.create.mutate({
			projectId: project1.id,
			title: "P1 Task",
		});
		const t2 = await client.task.create.mutate({
			projectId: project2.id,
			title: "P2 Task",
		});

		// Tasks are isolated per project
		const p1Tasks = await client.task.list.query({
			projectId: project1.id,
		});
		const p2Tasks = await client.task.list.query({
			projectId: project2.id,
		});

		expect(p1Tasks.items.some((t) => t.id === t1.id)).toBe(true);
		expect(p1Tasks.items.some((t) => t.id === t2.id)).toBe(false);
		expect(p2Tasks.items.some((t) => t.id === t2.id)).toBe(true);
		expect(p2Tasks.items.some((t) => t.id === t1.id)).toBe(false);

		// Deleting project1 should not affect project2
		await client.project.delete.mutate({ projectId: project1.id });
		const p2TasksAfter = await client.task.list.query({
			projectId: project2.id,
		});
		expect(p2TasksAfter.items.some((t) => t.id === t2.id)).toBe(true);
	});
});
