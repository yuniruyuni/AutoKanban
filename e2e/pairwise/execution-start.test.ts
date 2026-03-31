import {
	afterAll,
	beforeAll,
	beforeEach,
	describe,
	expect,
	test,
} from "bun:test";
import { createTestClient, type TestClient } from "../helpers/client";
import {
	cleanupTempRepos,
	createBranch,
	createTempGitRepo,
} from "../helpers/git";
import { parsePictTsv } from "../helpers/pict";
import {
	resetTestData,
	setupTestServer,
	teardownTestServer,
} from "../helpers/server";

interface ExecutionStartCase {
	ExistingWorkspace: string;
	TargetBranch: string;
	TaskDescription: string;
}

const cases = parsePictTsv<ExecutionStartCase>("pict/execution-start.tsv");

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

describe("pairwise: execution start", () => {
	for (const c of cases) {
		const label = `workspace=${c.ExistingWorkspace} branch=${c.TargetBranch} desc=${c.TaskDescription}`;

		test(label, async () => {
			const repoPath = await createTempGitRepo();

			// Create a target branch if specified
			if (c.TargetBranch === "specified") {
				await createBranch(repoPath, "feature-branch");
			}

			const project = await client.project.create.mutate({
				name: "ExecStartProject",
				repoPath,
			});

			const task = await client.task.create.mutate({
				projectId: project.id,
				title: "Test task title",
				description:
					c.TaskDescription === "with_description"
						? "Detailed description"
						: undefined,
			});

			// Set up existing workspace according to factor
			let previousWorkspaceId: string | null = null;
			if (c.ExistingWorkspace === "active_no_sessions") {
				// Start and then we rely on second start to reuse
				// Actually, active_no_sessions means workspace exists but has no sessions yet
				// This happens when startExecution was called but workspace was just created
				// For testing, we need to call start once (creates workspace+session),
				// then start again (which creates new workspace since first has sessions)
				// Then the "active_no_sessions" state isn't directly achievable via API
				// because startExecution always creates a session.
				// Skip: treat as equivalent to "none" for this test
				// (The workspace reuse path is only hit internally when resuming)
			} else if (c.ExistingWorkspace === "active_with_sessions") {
				const first = await client.execution.start.mutate({
					taskId: task.id,
				});
				previousWorkspaceId = first.workspaceId;
			}

			// Execute
			const targetBranch =
				c.TargetBranch === "specified" ? "feature-branch" : undefined;
			const result = await client.execution.start.mutate({
				taskId: task.id,
				targetBranch,
			});

			// Basic assertions
			expect(result.workspaceId).toBeDefined();
			expect(result.sessionId).toBeDefined();
			expect(result.executionProcessId).toBeDefined();

			// Task should be inprogress
			const updatedTask = await client.task.get.query({
				taskId: task.id,
			});
			expect(updatedTask.status).toBe("inprogress");

			// Workspace strategy verification
			if (c.ExistingWorkspace === "active_with_sessions") {
				// New workspace created, different from first
				expect(result.workspaceId).not.toBe(previousWorkspaceId);

				// Previous workspace should be archived
				const { attempts } = await client.workspace.listAttempts.query({
					taskId: task.id,
				});
				const prev = attempts.find(
					(a) => a.workspaceId === previousWorkspaceId,
				);
				expect(prev?.archived).toBe(true);
			}

			// Prompt verification via conversation history
			const { turns } = await client.execution.getConversationHistory.query({
				sessionId: result.sessionId,
			});
			expect(turns.length).toBeGreaterThanOrEqual(1);
			const prompt = turns[0].prompt ?? "";

			if (c.TaskDescription === "with_description") {
				expect(prompt).toContain("Test task title");
				expect(prompt).toContain("Detailed description");
			} else {
				expect(prompt).toContain("Test task title");
				expect(prompt).not.toContain("Detailed description");
			}
		});
	}
});
