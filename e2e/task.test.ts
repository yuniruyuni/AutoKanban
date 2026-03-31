import {
	afterAll,
	beforeAll,
	beforeEach,
	describe,
	expect,
	test,
} from "bun:test";
import { TRPCClientError } from "@trpc/client";
import { createTestClient, type TestClient } from "./helpers/client";
import { cleanupTempRepos, createTempGitRepo } from "./helpers/git";
import {
	resetTestData,
	setupTestServer,
	teardownTestServer,
} from "./helpers/server";

let client: TestClient;
let repoPath: string;
let projectId: string;

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
	repoPath = await createTempGitRepo();
	const project = await client.project.create.mutate({
		name: "Test Project",
		repoPath,
	});
	projectId = project.id;
});

describe("task CRUD", () => {
	test("create → get → update → delete", async () => {
		// Create
		const created = await client.task.create.mutate({
			projectId,
			title: "My Task",
			description: "Task description",
		});
		expect(created.id).toBeDefined();
		expect(created.title).toBe("My Task");
		expect(created.status).toBe("todo");

		// Get
		const fetched = await client.task.get.query({ taskId: created.id });
		expect(fetched.id).toBe(created.id);
		expect(fetched.title).toBe("My Task");

		// Update title
		const updated = await client.task.update.mutate({
			taskId: created.id,
			title: "Updated Task",
		});
		expect(updated.title).toBe("Updated Task");

		// Delete
		await client.task.delete.mutate({ taskId: created.id });

		// Verify deleted
		try {
			await client.task.get.query({ taskId: created.id });
			expect.unreachable("should have thrown");
		} catch (e) {
			expect(e).toBeInstanceOf(TRPCClientError);
		}
	});

	test("list with status filter", async () => {
		// Create tasks
		const t1 = await client.task.create.mutate({
			projectId,
			title: "Todo Task",
		});
		const t2 = await client.task.create.mutate({
			projectId,
			title: "In Progress Task",
		});
		await client.task.update.mutate({
			taskId: t2.id,
			status: "inprogress",
		});

		// List all
		const all = await client.task.list.query({ projectId });
		// May include template-generated tasks + our 2 tasks
		const ourTaskIds = [t1.id, t2.id];
		expect(all.items.filter((t) => ourTaskIds.includes(t.id))).toHaveLength(2);

		// List by status: todo
		const todos = await client.task.list.query({
			projectId,
			status: "todo",
		});
		expect(todos.items.some((t) => t.id === t1.id)).toBe(true);
		expect(todos.items.some((t) => t.id === t2.id)).toBe(false);

		// List by status: inprogress
		const inProgress = await client.task.list.query({
			projectId,
			status: "inprogress",
		});
		expect(inProgress.items.some((t) => t.id === t2.id)).toBe(true);
		expect(inProgress.items.some((t) => t.id === t1.id)).toBe(false);
	});

	test("update status transition", async () => {
		const task = await client.task.create.mutate({
			projectId,
			title: "Status Task",
		});
		expect(task.status).toBe("todo");

		// todo → inprogress
		const s1 = await client.task.update.mutate({
			taskId: task.id,
			status: "inprogress",
		});
		expect(s1.status).toBe("inprogress");

		// inprogress → inreview
		const s2 = await client.task.update.mutate({
			taskId: task.id,
			status: "inreview",
		});
		expect(s2.status).toBe("inreview");

		// inreview → done
		const s3 = await client.task.update.mutate({
			taskId: task.id,
			status: "done",
		});
		expect(s3.status).toBe("done");
	});
});
