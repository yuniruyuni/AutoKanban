import {
	afterAll,
	beforeAll,
	beforeEach,
	describe,
	expect,
	test,
} from "bun:test";
import { createTestClient, type TestClient } from "../helpers/client";
import { cleanupTempRepos, createTempGitRepo } from "../helpers/git";
import { parsePictTsv } from "../helpers/pict";
import {
	resetTestData,
	setupTestServer,
	teardownTestServer,
} from "../helpers/server";

interface TaskStatusCase {
	FromStatus: string;
	ToStatus: string;
	HasActiveWorkspace: string;
}

const cases = parsePictTsv<TaskStatusCase>("pict/task-status.tsv");

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

describe("pairwise: task status transitions", () => {
	for (const c of cases) {
		// Skip same-status transitions (PICT generates them with HasActiveWorkspace="")
		if (c.FromStatus === c.ToStatus) continue;

		const label = `${c.FromStatus} → ${c.ToStatus} (workspace=${c.HasActiveWorkspace})`;

		test(label, async () => {
			const repoPath = await createTempGitRepo();
			const project = await client.project.create.mutate({
				name: "StatusProject",
				repoPath,
			});
			const task = await client.task.create.mutate({
				projectId: project.id,
				title: "Status task",
			});

			// Set up active workspace if needed
			let workspaceId: string | null = null;
			if (c.HasActiveWorkspace === "yes") {
				const exec = await client.execution.start.mutate({
					taskId: task.id,
				});
				workspaceId = exec.workspaceId;
			}

			// Move to FromStatus (task starts as "todo")
			if (c.FromStatus !== "todo") {
				await client.task.update.mutate({
					taskId: task.id,
					status: c.FromStatus as
						| "inprogress"
						| "inreview"
						| "done"
						| "cancelled",
				});
			}

			// Transition to ToStatus
			const updated = await client.task.update.mutate({
				taskId: task.id,
				status: c.ToStatus as
					| "todo"
					| "inprogress"
					| "inreview"
					| "done"
					| "cancelled",
			});

			// Verify status changed
			expect(updated.status as string).toBe(c.ToStatus);

			// Verify side effects for "todo" transition (chat reset)
			if (c.ToStatus === "todo" && c.HasActiveWorkspace === "yes") {
				// Workspace should be archived
				const { attempts } = await client.workspace.listAttempts.query({
					taskId: task.id,
				});
				const ws = attempts.find((a) => a.workspaceId === workspaceId);
				expect(ws?.archived).toBe(true);
			}
		});
	}
});
