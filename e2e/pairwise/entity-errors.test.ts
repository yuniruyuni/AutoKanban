import {
	afterAll,
	beforeAll,
	beforeEach,
	describe,
	expect,
	test,
} from "bun:test";
import { TRPCClientError } from "@trpc/client";
import { createTestClient, type TestClient } from "../helpers/client";
import { cleanupTempRepos } from "../helpers/git";
import {
	resetTestData,
	setupTestServer,
	teardownTestServer,
} from "../helpers/server";

let client: TestClient;
const FAKE_UUID = "00000000-0000-0000-0000-000000000000";

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

function expectNotFound(e: unknown): void {
	expect(e).toBeInstanceOf(TRPCClientError);
	const data = (e as { data?: { httpStatus?: number; code?: string } }).data;
	expect(data?.httpStatus).toBe(404);
	expect(data?.code).toBe("NOT_FOUND");
}

describe("entity not found errors", () => {
	test("project.get with nonexistent ID", async () => {
		try {
			await client.project.get.query({ projectId: FAKE_UUID });
			expect.unreachable("should throw");
		} catch (e) {
			expectNotFound(e);
		}
	});

	test("task.get with nonexistent ID", async () => {
		try {
			await client.task.get.query({ taskId: FAKE_UUID });
			expect.unreachable("should throw");
		} catch (e) {
			expectNotFound(e);
		}
	});

	test("task.update with nonexistent ID", async () => {
		try {
			await client.task.update.mutate({
				taskId: FAKE_UUID,
				title: "updated",
			});
			expect.unreachable("should throw");
		} catch (e) {
			expectNotFound(e);
		}
	});

	test("task.delete with nonexistent ID", async () => {
		try {
			await client.task.delete.mutate({ taskId: FAKE_UUID });
			expect.unreachable("should throw");
		} catch (e) {
			expectNotFound(e);
		}
	});

	test("execution.start with nonexistent task", async () => {
		try {
			await client.execution.start.mutate({ taskId: FAKE_UUID });
			expect.unreachable("should throw");
		} catch (e) {
			expectNotFound(e);
		}
	});

	test("git.listBranches with nonexistent project", async () => {
		try {
			await client.git.listBranches.query({ projectId: FAKE_UUID });
			expect.unreachable("should throw");
		} catch (e) {
			expectNotFound(e);
		}
	});

	test("execution.get with nonexistent process", async () => {
		try {
			await client.execution.get.query({
				executionProcessId: FAKE_UUID,
			});
			expect.unreachable("should throw");
		} catch (e) {
			expectNotFound(e);
		}
	});

	test("task.create with nonexistent project", async () => {
		try {
			await client.task.create.mutate({
				projectId: FAKE_UUID,
				title: "orphan task",
			});
			expect.unreachable("should throw");
		} catch (e) {
			expectNotFound(e);
		}
	});
});
