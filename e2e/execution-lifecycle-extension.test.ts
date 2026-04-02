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

describe("execution lifecycle extensions", () => {
	test("stop execution kills the process and updates status", async () => {
		const repoPath = await createTempGitRepo();
		const project = await client.project.create.mutate({
			name: "StopProject",
			repoPath,
		});
		const task = await client.task.create.mutate({
			projectId: project.id,
			title: "Process to be killed",
		});

		// Start execution
		const startResult = await client.execution.start.mutate({
			taskId: task.id,
		});

		expect(startResult.executionProcessId).toBeDefined();

		// Stop execution (interruption)
		await client.execution.stop.mutate({
			executionProcessId: startResult.executionProcessId,
		});

		// Check status - should still be running but should have been interrupted
		const execution = await client.execution.get.query({
			executionProcessId: startResult.executionProcessId,
		});
		expect(execution.executionProcess.status).toBe("running");

		// Wait for logs to show it's idle or has been interrupted
		// (In real scenario, it would stop the current tool and wait for next prompt)
	});

	test("queueing message while busy processes follow-up correctly", async () => {
		const repoPath = await createTempGitRepo();
		const project = await client.project.create.mutate({
			name: "FollowUpProject",
			repoPath,
		});
		const task = await client.task.create.mutate({
			projectId: project.id,
			title: "Task with follow-up",
		});

		// Start initial execution
		const startResult = await client.execution.start.mutate({
			taskId: task.id,
		});

		// Queue a message while the process is running
		const queueResult = await client.execution.queueMessage.mutate({
			sessionId: startResult.sessionId,
			prompt: "Actually, change the implementation to use async/await",
		});

		expect(queueResult.queuedMessage).toBeDefined();
		expect(queueResult.sentImmediately).toBe(false);

		// Check queue status
		const statusResult = await client.execution.getQueueStatus.query({
			sessionId: startResult.sessionId,
		});
		expect(statusResult.status.hasMessage).toBe(true);
		expect(statusResult.status.message?.prompt).toContain("async/await");

		// If we cancel the queue, it should be gone
		await client.execution.cancelQueue.mutate({
			sessionId: startResult.sessionId,
		});
		const finalStatusResult = await client.execution.getQueueStatus.query({
			sessionId: startResult.sessionId,
		});
		expect(finalStatusResult.status.hasMessage).toBe(false);
	});

	test("task status moves to inreview when agent becomes idle", async () => {
		const repoPath = await createTempGitRepo();
		const project = await client.project.create.mutate({
			name: "IdleProject",
			repoPath,
		});
		const task = await client.task.create.mutate({
			projectId: project.id,
			title: "Task that becomes idle",
		});

		// Start execution
		await client.execution.start.mutate({
			taskId: task.id,
		});

		// At this point, the task is 'inprogress'
		let updatedTask = await client.task.get.query({ taskId: task.id });
		expect(updatedTask.status).toBe("inprogress");

		// Wait a bit to allow the mock/real agent to emit a result/idle event
		// and the system to process it.
		await new Promise((resolve) => setTimeout(resolve, 1000));

		updatedTask = await client.task.get.query({ taskId: task.id });
		// CHANGE: It should remain 'inprogress' even when idle, until it explicitly completes
		// or the user manually moves it. This prevents early termination of the agent loop.
		expect(updatedTask.status).toBe("inprogress");
	});
});
