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

describe("execution lifecycle", () => {
	test("start execution creates workspace, session, and process", async () => {
		const repoPath = await createTempGitRepo();
		const project = await client.project.create.mutate({
			name: "ExecProject",
			repoPath,
		});
		const task = await client.task.create.mutate({
			projectId: project.id,
			title: "Implement feature",
			description: "Build the thing",
		});

		// Start execution
		const result = await client.execution.start.mutate({
			taskId: task.id,
		});

		expect(result.workspaceId).toBeDefined();
		expect(result.sessionId).toBeDefined();
		expect(result.executionProcessId).toBeDefined();
		expect(result.worktreePath).toBeDefined();

		// Task should be moved to inprogress
		const updatedTask = await client.task.get.query({ taskId: task.id });
		expect(updatedTask.status).toBe("inprogress");

		// Execution process should be retrievable
		const execution = await client.execution.get.query({
			executionProcessId: result.executionProcessId,
		});
		expect(execution.executionProcess.id).toBe(result.executionProcessId);
		expect(execution.executionProcess.status).toBe("running");

		// Latest execution for task
		const latest = await client.execution.getLatest.query({
			taskId: task.id,
		});
		expect(latest.executionProcess?.id).toBe(result.executionProcessId);
	});

	test("second start creates new attempt (archives previous workspace)", async () => {
		const repoPath = await createTempGitRepo();
		const project = await client.project.create.mutate({
			name: "AttemptsProject",
			repoPath,
		});
		const task = await client.task.create.mutate({
			projectId: project.id,
			title: "Multi-attempt task",
		});

		// First attempt
		const first = await client.execution.start.mutate({
			taskId: task.id,
		});

		// Second attempt (creates new workspace since first has sessions)
		const second = await client.execution.start.mutate({
			taskId: task.id,
		});

		expect(second.workspaceId).not.toBe(first.workspaceId);

		// List attempts
		const { attempts } = await client.workspace.listAttempts.query({
			taskId: task.id,
		});
		expect(attempts.length).toBeGreaterThanOrEqual(2);

		// First attempt should be archived
		const firstAttempt = attempts.find(
			(a) => a.workspaceId === first.workspaceId,
		);
		expect(firstAttempt?.archived).toBe(true);
	});

	test("conversation history tracks initial prompt from task", async () => {
		const repoPath = await createTempGitRepo();
		const project = await client.project.create.mutate({
			name: "ConvProject",
			repoPath,
		});
		const task = await client.task.create.mutate({
			projectId: project.id,
			title: "Conversation task",
			description: "Do something interesting",
		});

		const result = await client.execution.start.mutate({
			taskId: task.id,
		});

		// Conversation history should have the initial turn
		const { turns } = await client.execution.getConversationHistory.query({
			sessionId: result.sessionId,
		});
		expect(turns.length).toBeGreaterThanOrEqual(1);
		// First turn prompt should come from the task title
		expect(turns[0].prompt).toContain("Conversation task");
		expect(turns[0].prompt).toContain("Do something interesting");
	});

	test("getAttemptExecution returns session and process info", async () => {
		const repoPath = await createTempGitRepo();
		const project = await client.project.create.mutate({
			name: "AttemptExecProject",
			repoPath,
		});
		const task = await client.task.create.mutate({
			projectId: project.id,
			title: "Attempt exec task",
		});

		const result = await client.execution.start.mutate({
			taskId: task.id,
		});

		const attemptExec = await client.workspace.getAttemptExecution.query({
			workspaceId: result.workspaceId,
		});
		expect(attemptExec.sessionId).toBe(result.sessionId);
		expect(attemptExec.executionProcessId).toBe(result.executionProcessId);
	});
});
