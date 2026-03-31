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

describe("project CRUD", () => {
	test("create → get → list → update → delete", async () => {
		const repoPath = await createTempGitRepo();

		// Create
		const created = await client.project.create.mutate({
			name: "Test Project",
			description: "A test project",
			repoPath,
		});
		expect(created.id).toBeDefined();
		expect(created.name).toBe("Test Project");
		expect(created.description).toBe("A test project");
		expect(created.repoPath).toBe(repoPath);

		// Get
		const fetched = await client.project.get.query({
			projectId: created.id,
		});
		expect(fetched.id).toBe(created.id);
		expect(fetched.name).toBe("Test Project");

		// List
		const { projects } = await client.project.list.query();
		expect(projects.length).toBeGreaterThanOrEqual(1);
		expect(projects.some((p) => p.id === created.id)).toBe(true);

		// Update
		const updated = await client.project.update.mutate({
			projectId: created.id,
			name: "Updated Project",
		});
		expect(updated.name).toBe("Updated Project");

		// Delete
		await client.project.delete.mutate({
			projectId: created.id,
		});

		// Verify deleted
		const { projects: afterDelete } = await client.project.list.query();
		expect(afterDelete.some((p) => p.id === created.id)).toBe(false);
	});

	test("get non-existent project returns error", async () => {
		const fakeId = "00000000-0000-0000-0000-000000000000";
		try {
			await client.project.get.query({ projectId: fakeId });
			expect.unreachable("should have thrown");
		} catch (e) {
			expect(e).toBeInstanceOf(TRPCClientError);
		}
	});

	test("create with duplicate repoPath returns error", async () => {
		const repoPath = await createTempGitRepo();

		await client.project.create.mutate({
			name: "First",
			repoPath,
		});

		try {
			await client.project.create.mutate({
				name: "Second",
				repoPath,
			});
			expect.unreachable("should have thrown");
		} catch (e) {
			expect(e).toBeInstanceOf(TRPCClientError);
		}
	});
});
