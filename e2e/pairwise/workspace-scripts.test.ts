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
import {
	cleanupTempRepos,
	createTempGitRepo,
	writeAutoKanbanConfig,
} from "../helpers/git";
import { parsePictTsv } from "../helpers/pict";
import {
	resetTestData,
	setupTestServer,
	teardownTestServer,
} from "../helpers/server";

interface WorkspaceScriptsCase {
	ScriptType: string;
	ConfigState: string;
	WorkspaceState: string;
	ScriptAlreadyRunning: string;
}

const cases = parsePictTsv<WorkspaceScriptsCase>("pict/workspace-scripts.tsv");

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

function isErrorExpected(c: WorkspaceScriptsCase): boolean {
	if (c.WorkspaceState === "no_workspace") return true;
	if (c.WorkspaceState === "active_no_worktree") return true;
	if (c.ScriptAlreadyRunning === "yes" && c.ScriptType !== "devserver")
		return true;
	if (c.ConfigState === "config_script_null") return true;
	if (c.ConfigState === "no_config_file") return true;
	return false;
}

describe("pairwise: workspace scripts", () => {
	for (const c of cases) {
		const label = `${c.ScriptType} config=${c.ConfigState} ws=${c.WorkspaceState} running=${c.ScriptAlreadyRunning}`;

		test(label, async () => {
			const repoPath = await createTempGitRepo();
			const project = await client.project.create.mutate({
				name: "ScriptProject",
				repoPath,
			});
			const task = await client.task.create.mutate({
				projectId: project.id,
				title: "Script task",
			});

			let worktreePath: string | undefined;
			let devserverProcessId: string | undefined;
			const processIdsToStop: string[] = [];

			// Set up workspace state
			if (c.WorkspaceState === "active_with_worktree") {
				const exec = await client.execution.start.mutate({
					taskId: task.id,
				});
				worktreePath = exec.worktreePath;

				// Use sleep for any "already running" scenario to keep process alive
				const needsLongRunning = c.ScriptAlreadyRunning === "yes";

				// Set up config in worktree
				if (c.ConfigState === "config_with_script") {
					await writeAutoKanbanConfig(worktreePath, {
						prepare: needsLongRunning ? "sleep 60" : "echo PREPARE_OK",
						cleanup: needsLongRunning ? "sleep 60" : "echo CLEANUP_OK",
						server: needsLongRunning ? "sleep 60" : "echo DEVSERVER_OK",
					});
				} else if (c.ConfigState === "config_script_null") {
					await writeAutoKanbanConfig(worktreePath, {
						prepare: null,
						cleanup: null,
						server: null,
					});
				}
				// no_config_file: don't write anything

				// Set up "already running" script if needed
				if (c.ScriptAlreadyRunning === "yes") {
					if (c.ScriptType === "devserver") {
						if (c.ConfigState === "config_with_script") {
							const result = await client.devServer.start.mutate({
								taskId: task.id,
							});
							devserverProcessId = result.executionProcessId;
							processIdsToStop.push(result.executionProcessId);
						}
					} else if (c.ConfigState === "config_with_script") {
						// Start a long-running script for exclusivity test
						if (c.ScriptType === "prepare") {
							const result = await client.execution.runPrepare.mutate({
								taskId: task.id,
							});
							processIdsToStop.push(result.executionProcessId);
						} else {
							const result = await client.execution.runCleanup.mutate({
								taskId: task.id,
							});
							processIdsToStop.push(result.executionProcessId);
						}
					}
				}
			}

			const shouldError = isErrorExpected(c);

			// Execute the operation
			try {
				if (c.ScriptType === "devserver") {
					const result = await client.devServer.start.mutate({
						taskId: task.id,
					});
					if (shouldError) {
						expect.unreachable("should have thrown");
					}
					expect(result.executionProcessId).toBeDefined();

					// Idempotency: if already running, should return same processId
					if (c.ScriptAlreadyRunning === "yes" && devserverProcessId) {
						expect(result.executionProcessId).toBe(devserverProcessId);
					}
				} else if (c.ScriptType === "prepare") {
					const result = await client.execution.runPrepare.mutate({
						taskId: task.id,
					});
					if (shouldError) {
						expect.unreachable("should have thrown");
					}
					expect(result.executionProcessId).toBeDefined();
				} else {
					const result = await client.execution.runCleanup.mutate({
						taskId: task.id,
					});
					if (shouldError) {
						expect.unreachable("should have thrown");
					}
					expect(result.executionProcessId).toBeDefined();
				}
			} catch (e) {
				if (!shouldError) {
					throw e;
				}
				expect(e).toBeInstanceOf(TRPCClientError);
			} finally {
				// Clean up long-running processes
				for (const pid of processIdsToStop) {
					try {
						await client.devServer.stop.mutate({
							executionProcessId: pid,
						});
					} catch {
						// Process may have already exited
					}
				}
			}
		});
	}
});
