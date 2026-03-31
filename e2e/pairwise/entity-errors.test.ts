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

describe("entity not found errors", () => {
	test("project.get with nonexistent ID", async () => {
		try {
			await client.project.get.query({ projectId: FAKE_UUID });
			expect.unreachable("should throw");
		} catch (e) {
			expect(e).toBeInstanceOf(TRPCClientError);
		}
	});

	test("task.get with nonexistent ID", async () => {
		try {
			await client.task.get.query({ taskId: FAKE_UUID });
			expect.unreachable("should throw");
		} catch (e) {
			expect(e).toBeInstanceOf(TRPCClientError);
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
			expect(e).toBeInstanceOf(TRPCClientError);
		}
	});

	test("task.delete with nonexistent ID", async () => {
		try {
			await client.task.delete.mutate({ taskId: FAKE_UUID });
			expect.unreachable("should throw");
		} catch (e) {
			expect(e).toBeInstanceOf(TRPCClientError);
		}
	});

	test("execution.start with nonexistent task", async () => {
		try {
			await client.execution.start.mutate({ taskId: FAKE_UUID });
			expect.unreachable("should throw");
		} catch (e) {
			expect(e).toBeInstanceOf(TRPCClientError);
		}
	});

	test("git.listBranches with nonexistent project", async () => {
		try {
			await client.git.listBranches.query({ projectId: FAKE_UUID });
			expect.unreachable("should throw");
		} catch (e) {
			expect(e).toBeInstanceOf(TRPCClientError);
		}
	});

	test("execution.get with nonexistent process", async () => {
		try {
			await client.execution.get.query({
				executionProcessId: FAKE_UUID,
			});
			expect.unreachable("should throw");
		} catch (e) {
			expect(e).toBeInstanceOf(TRPCClientError);
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
			expect(e).toBeInstanceOf(TRPCClientError);
		}
	});
});
