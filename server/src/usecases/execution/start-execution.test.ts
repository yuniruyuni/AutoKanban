import { describe, expect, test } from "bun:test";
import {
	createTestProject,
	createTestTask,
	createTestWorkspace,
} from "../../../test/factories";
import { createMockContext } from "../../../test/helpers/context";
import {
	createMockWorktreeRepository,
	createMockWorktreeRepositoryCreationFails,
} from "../../../test/helpers/git";
import { startExecution } from "./start-execution";

// Default mocks for workspaceConfig and scriptRunner (no prepare/cleanup configured)
const defaultWorkspaceConfig = {
	load: async () => ({ prepare: null, server: null, cleanup: null }),
} as never;

const defaultScriptRunner = {
	run: async () => ({ exitCode: 0, stdout: "", stderr: "" }),
} as never;

const defaultAgentSetting = {
	get: async () => null,
} as never;

describe("startExecution", () => {
	// ===== Successful Cases =====

	test("creates new workspace and session for task without existing workspace", async () => {
		const task = createTestTask({
			title: "Test Task",
			description: "Test description",
		});
		const project = createTestProject({ id: task.projectId });

		let upsertedWorkspace: unknown = null;
		let upsertedSession: unknown = null;

		const ctx = createMockContext({
			task: { get: () => task, upsert: () => {} } as never,
			project: { get: () => project } as never,
			workspace: {
				get: () => null, // No existing workspace
				getMaxAttempt: () => 0,
				upsert: (ws: unknown) => {
					upsertedWorkspace = ws;
				},
			} as never,
			workspaceRepo: { upsert: () => {} } as never,
			session: {
				upsert: (s: unknown) => {
					upsertedSession = s;
				},
			} as never,
			codingAgentTurn: {
				findLatestResumeInfoByWorkspaceId: () => null,
				upsert: () => {},
			} as never,
			codingAgentProcess: { upsert: () => {} } as never,
			agentSetting: defaultAgentSetting,
			worktree: createMockWorktreeRepository(),
			workspaceConfig: defaultWorkspaceConfig,
			scriptRunner: defaultScriptRunner,
			workspaceScriptProcess: { upsert: () => {} } as never,
			workspaceScriptProcessLogs: { upsertLogs: () => {} } as never,
			executor: {
				startProtocol: async () => ({
					id: "exec-1",
					sessionId: "session-1",
					runReason: "codingagent",
					startedAt: new Date(),
				}),
			} as never,
		});

		const result = await startExecution(task.id).run(ctx);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.workspaceId).toBeDefined();
			expect(result.value.sessionId).toBeDefined();
			expect(result.value.executionProcessId).toBeDefined();
			expect(result.value.worktreePath).toBeDefined();
		}
		expect(upsertedWorkspace).not.toBeNull();
		expect(upsertedSession).not.toBeNull();
	});

	test("reuses existing workspace when it has no sessions (never executed)", async () => {
		const task = createTestTask({ title: "Test Task" });
		const project = createTestProject({ id: task.projectId });
		const existingWorkspace = createTestWorkspace({ taskId: task.id });

		const ctx = createMockContext({
			task: { get: () => task, upsert: () => {} } as never,
			project: { get: () => project } as never,
			workspace: {
				get: () => existingWorkspace,
				getMaxAttempt: () => 1,
				upsert: () => {},
			} as never,
			workspaceRepo: { upsert: () => {} } as never,
			session: {
				list: () => ({ items: [], hasMore: false }),
				upsert: () => {},
			} as never,
			codingAgentTurn: {
				findLatestResumeInfoByWorkspaceId: () => null,
				upsert: () => {},
			} as never,
			codingAgentProcess: { upsert: () => {} } as never,
			agentSetting: defaultAgentSetting,
			worktree: createMockWorktreeRepository(),
			workspaceConfig: defaultWorkspaceConfig,
			scriptRunner: defaultScriptRunner,
			workspaceScriptProcess: { upsert: () => {} } as never,
			workspaceScriptProcessLogs: { upsertLogs: () => {} } as never,
			executor: {
				startProtocol: async () => ({
					id: "exec-2",
					sessionId: "session-2",
					runReason: "codingagent",
					startedAt: new Date(),
				}),
			} as never,
		});

		const result = await startExecution(task.id).run(ctx);

		expect(result.ok).toBe(true);
		if (result.ok) {
			// Should use the existing workspace ID
			expect(result.value.workspaceId).toBe(existingWorkspace.id);
		}
	});

	test("archives existing workspace and creates new attempt when it has sessions", async () => {
		const task = createTestTask({ title: "Test Task" });
		const project = createTestProject({ id: task.projectId });
		const existingWorkspace = createTestWorkspace({
			taskId: task.id,
			attempt: 1,
		});

		const upsertedWorkspaces: { id: string; archived?: boolean }[] = [];

		const ctx = createMockContext({
			task: { get: () => task, upsert: () => {} } as never,
			project: { get: () => project } as never,
			workspace: {
				get: () => existingWorkspace,
				getMaxAttempt: () => 1,
				upsert: (ws: { id: string; archived?: boolean }) => {
					upsertedWorkspaces.push(ws);
				},
			} as never,
			workspaceRepo: { upsert: () => {} } as never,
			session: {
				// Has sessions — workspace has been executed
				list: () => ({
					items: [{ id: "session-prev" }],
					hasMore: false,
				}),
				upsert: () => {},
			} as never,
			codingAgentTurn: {
				findLatestResumeInfoByWorkspaceId: () => null,
				upsert: () => {},
			} as never,
			codingAgentProcess: { upsert: () => {} } as never,
			agentSetting: defaultAgentSetting,
			worktree: createMockWorktreeRepository(),
			workspaceConfig: defaultWorkspaceConfig,
			scriptRunner: defaultScriptRunner,
			workspaceScriptProcess: { upsert: () => {} } as never,
			workspaceScriptProcessLogs: { upsertLogs: () => {} } as never,
			executor: {
				startProtocol: async () => ({
					id: "exec-new",
					sessionId: "session-new",
					runReason: "codingagent",
					startedAt: new Date(),
				}),
			} as never,
		});

		const result = await startExecution(task.id).run(ctx);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.workspaceId).not.toBe(existingWorkspace.id);
		}

		const archivedWs = upsertedWorkspaces.find(
			(ws) => ws.id === existingWorkspace.id,
		);
		expect(archivedWs?.archived).toBe(true);

		const newWs = upsertedWorkspaces.find(
			(ws) => ws.id !== existingWorkspace.id,
		) as { attempt?: number };
		expect(newWs?.attempt).toBe(2);
	});

	test("generates prompt from task title and description", async () => {
		const task = createTestTask({
			title: "Implement feature X",
			description: "Detailed requirements here",
		});
		const project = createTestProject({ id: task.projectId });

		let capturedPrompt: string | undefined;

		const ctx = createMockContext({
			task: { get: () => task, upsert: () => {} } as never,
			project: { get: () => project } as never,
			workspace: {
				get: () => null,
				getMaxAttempt: () => 0,
				upsert: () => {},
			} as never,
			workspaceRepo: { upsert: () => {} } as never,
			session: { upsert: () => {} } as never,
			codingAgentTurn: {
				findLatestResumeInfoByWorkspaceId: () => null,
				upsert: () => {},
			} as never,
			codingAgentProcess: { upsert: () => {} } as never,
			agentSetting: defaultAgentSetting,
			worktree: createMockWorktreeRepository(),
			workspaceConfig: defaultWorkspaceConfig,
			scriptRunner: defaultScriptRunner,
			workspaceScriptProcess: { upsert: () => {} } as never,
			workspaceScriptProcessLogs: { upsertLogs: () => {} } as never,
			executor: {
				startProtocol: async (opts: { prompt: string }) => {
					capturedPrompt = opts.prompt;
					return {
						id: "exec-3",
						sessionId: "session-3",
						runReason: "codingagent",
						startedAt: new Date(),
					};
				},
			} as never,
		});

		await startExecution(task.id).run(ctx);

		expect(capturedPrompt).toBe(
			"Implement feature X\n\nDetailed requirements here",
		);
	});

	test("generates prompt from task title only when no description", async () => {
		const task = createTestTask({
			title: "Simple task",
			description: undefined,
		});
		const project = createTestProject({ id: task.projectId });

		let capturedPrompt: string | undefined;

		const ctx = createMockContext({
			task: { get: () => task, upsert: () => {} } as never,
			project: { get: () => project } as never,
			workspace: {
				get: () => null,
				getMaxAttempt: () => 0,
				upsert: () => {},
			} as never,
			workspaceRepo: { upsert: () => {} } as never,
			session: { upsert: () => {} } as never,
			codingAgentTurn: {
				findLatestResumeInfoByWorkspaceId: () => null,
				upsert: () => {},
			} as never,
			codingAgentProcess: { upsert: () => {} } as never,
			agentSetting: defaultAgentSetting,
			worktree: createMockWorktreeRepository(),
			workspaceConfig: defaultWorkspaceConfig,
			scriptRunner: defaultScriptRunner,
			workspaceScriptProcess: { upsert: () => {} } as never,
			workspaceScriptProcessLogs: { upsertLogs: () => {} } as never,
			executor: {
				startProtocol: async (opts: { prompt: string }) => {
					capturedPrompt = opts.prompt;
					return {
						id: "exec-4",
						sessionId: "session-4",
						runReason: "codingagent",
						startedAt: new Date(),
					};
				},
			} as never,
		});

		await startExecution(task.id).run(ctx);

		expect(capturedPrompt).toBe("Simple task");
	});

	test("does not pass resume info when creating new attempt", async () => {
		const task = createTestTask({ title: "Test Task" });
		const project = createTestProject({ id: task.projectId });
		const existingWorkspace = createTestWorkspace({ taskId: task.id });

		let capturedResumeSessionId: string | undefined;

		const ctx = createMockContext({
			task: { get: () => task, upsert: () => {} } as never,
			project: { get: () => project } as never,
			workspace: {
				get: () => existingWorkspace,
				getMaxAttempt: () => 1,
				upsert: () => {},
			} as never,
			workspaceRepo: { upsert: () => {} } as never,
			session: {
				// Has sessions — will create new attempt, no resume
				list: () => ({
					items: [{ id: "session-prev" }],
					hasMore: false,
				}),
				upsert: () => {},
			} as never,
			codingAgentTurn: {
				findLatestResumeInfoByWorkspaceId: () => ({
					agentSessionId: "prev-session-abc",
					agentMessageId: "prev-message-xyz",
				}),
				upsert: () => {},
			} as never,
			codingAgentProcess: { upsert: () => {} } as never,
			agentSetting: defaultAgentSetting,
			worktree: createMockWorktreeRepository(),
			workspaceConfig: defaultWorkspaceConfig,
			scriptRunner: defaultScriptRunner,
			workspaceScriptProcess: { upsert: () => {} } as never,
			workspaceScriptProcessLogs: { upsertLogs: () => {} } as never,
			executor: {
				startProtocol: async (opts: { resumeSessionId?: string }) => {
					capturedResumeSessionId = opts.resumeSessionId;
					return {
						id: "exec-5",
						sessionId: "session-5",
						runReason: "codingagent",
						startedAt: new Date(),
					};
				},
			} as never,
		});

		await startExecution(task.id).run(ctx);

		// Should NOT pass resume info because new attempt = clean start
		expect(capturedResumeSessionId).toBeUndefined();
	});

	test("uses custom executor and variant when provided", async () => {
		const task = createTestTask({ title: "Test Task" });
		const project = createTestProject({ id: task.projectId });

		let upsertedSession: { executor?: string; variant?: string } | null = null;

		const ctx = createMockContext({
			task: { get: () => task, upsert: () => {} } as never,
			project: { get: () => project } as never,
			workspace: {
				get: () => null,
				getMaxAttempt: () => 0,
				upsert: () => {},
			} as never,
			workspaceRepo: { upsert: () => {} } as never,
			session: {
				upsert: (s: { executor?: string; variant?: string }) => {
					upsertedSession = s;
				},
			} as never,
			codingAgentTurn: {
				findLatestResumeInfoByWorkspaceId: () => null,
				upsert: () => {},
			} as never,
			codingAgentProcess: { upsert: () => {} } as never,
			agentSetting: defaultAgentSetting,
			variant: { get: () => null } as never,
			worktree: createMockWorktreeRepository(),
			workspaceConfig: defaultWorkspaceConfig,
			scriptRunner: defaultScriptRunner,
			workspaceScriptProcess: { upsert: () => {} } as never,
			workspaceScriptProcessLogs: { upsertLogs: () => {} } as never,
			executor: {
				startProtocol: async () => ({
					id: "exec-6",
					sessionId: "session-6",
					runReason: "codingagent",
					startedAt: new Date(),
				}),
			} as never,
		});

		await startExecution(task.id, {
			executor: "custom-executor",
			variant: "plan-mode",
		}).run(ctx);

		const session = upsertedSession as unknown as {
			executor?: string;
			variant?: string;
		};
		expect(session?.executor).toBe("custom-executor");
		expect(session?.variant).toBe("plan-mode");
	});

	test("passes variant permissionMode and model to executor when variant found", async () => {
		const task = createTestTask({ title: "Test Task" });
		const project = createTestProject({ id: task.projectId });

		let capturedPermissionMode: string | undefined;
		let capturedModel: string | undefined;

		const ctx = createMockContext({
			task: { get: () => task, upsert: () => {} } as never,
			project: { get: () => project } as never,
			workspace: {
				get: () => null,
				getMaxAttempt: () => 0,
				upsert: () => {},
			} as never,
			workspaceRepo: { upsert: () => {} } as never,
			session: { upsert: () => {} } as never,
			codingAgentTurn: {
				findLatestResumeInfoByWorkspaceId: () => null,
				upsert: () => {},
			} as never,
			codingAgentProcess: { upsert: () => {} } as never,
			agentSetting: defaultAgentSetting,
			variant: {
				get: () => ({
					id: "variant-1",
					executor: "claude-code",
					name: "PLAN",
					permissionMode: "plan",
					model: "opus",
					appendPrompt: null,
					createdAt: new Date(),
					updatedAt: new Date(),
				}),
			} as never,
			worktree: createMockWorktreeRepository(),
			workspaceConfig: defaultWorkspaceConfig,
			scriptRunner: defaultScriptRunner,
			workspaceScriptProcess: { upsert: () => {} } as never,
			workspaceScriptProcessLogs: { upsertLogs: () => {} } as never,
			executor: {
				startProtocol: async (opts: {
					permissionMode?: string;
					model?: string;
				}) => {
					capturedPermissionMode = opts.permissionMode;
					capturedModel = opts.model;
					return {
						id: "exec-9",
						sessionId: "session-9",
						runReason: "codingagent",
						startedAt: new Date(),
					};
				},
			} as never,
		});

		await startExecution(task.id, {
			variant: "PLAN",
		}).run(ctx);

		expect(capturedPermissionMode).toBe("plan");
		expect(capturedModel).toBe("opus");
	});

	test("does not pass permissionMode when variant not specified", async () => {
		const task = createTestTask({ title: "Test Task" });
		const project = createTestProject({ id: task.projectId });

		let capturedPermissionMode: string | undefined = "SHOULD_NOT_REMAIN";

		const ctx = createMockContext({
			task: { get: () => task, upsert: () => {} } as never,
			project: { get: () => project } as never,
			workspace: {
				get: () => null,
				getMaxAttempt: () => 0,
				upsert: () => {},
			} as never,
			workspaceRepo: { upsert: () => {} } as never,
			session: { upsert: () => {} } as never,
			codingAgentTurn: {
				findLatestResumeInfoByWorkspaceId: () => null,
				upsert: () => {},
			} as never,
			codingAgentProcess: { upsert: () => {} } as never,
			agentSetting: defaultAgentSetting,
			worktree: createMockWorktreeRepository(),
			workspaceConfig: defaultWorkspaceConfig,
			scriptRunner: defaultScriptRunner,
			workspaceScriptProcess: { upsert: () => {} } as never,
			workspaceScriptProcessLogs: { upsertLogs: () => {} } as never,
			executor: {
				startProtocol: async (opts: {
					permissionMode?: string;
					model?: string;
				}) => {
					capturedPermissionMode = opts.permissionMode;
					return {
						id: "exec-10",
						sessionId: "session-10",
						runReason: "codingagent",
						startedAt: new Date(),
					};
				},
			} as never,
		});

		await startExecution(task.id).run(ctx);

		expect(capturedPermissionMode).toBeUndefined();
	});

	test("falls back to input.model when variant has no model", async () => {
		const task = createTestTask({ title: "Test Task" });
		const project = createTestProject({ id: task.projectId });

		let capturedModel: string | undefined;

		const ctx = createMockContext({
			task: { get: () => task, upsert: () => {} } as never,
			project: { get: () => project } as never,
			workspace: {
				get: () => null,
				getMaxAttempt: () => 0,
				upsert: () => {},
			} as never,
			workspaceRepo: { upsert: () => {} } as never,
			session: { upsert: () => {} } as never,
			codingAgentTurn: {
				findLatestResumeInfoByWorkspaceId: () => null,
				upsert: () => {},
			} as never,
			codingAgentProcess: { upsert: () => {} } as never,
			agentSetting: defaultAgentSetting,
			variant: {
				get: () => ({
					id: "variant-2",
					executor: "claude-code",
					name: "DEFAULT",
					permissionMode: "bypassPermissions",
					model: null,
					appendPrompt: null,
					createdAt: new Date(),
					updatedAt: new Date(),
				}),
			} as never,
			worktree: createMockWorktreeRepository(),
			workspaceConfig: defaultWorkspaceConfig,
			scriptRunner: defaultScriptRunner,
			workspaceScriptProcess: { upsert: () => {} } as never,
			workspaceScriptProcessLogs: { upsertLogs: () => {} } as never,
			executor: {
				startProtocol: async (opts: { model?: string }) => {
					capturedModel = opts.model;
					return {
						id: "exec-11",
						sessionId: "session-11",
						runReason: "codingagent",
						startedAt: new Date(),
					};
				},
			} as never,
		});

		await startExecution(task.id, {
			variant: "DEFAULT",
			model: "sonnet",
		}).run(ctx);

		// variant.model is null, so should fall back to input.model
		expect(capturedModel).toBe("sonnet");
	});

	test("variant model takes precedence over input model", async () => {
		const task = createTestTask({ title: "Test Task" });
		const project = createTestProject({ id: task.projectId });

		let capturedModel: string | undefined;

		const ctx = createMockContext({
			task: { get: () => task, upsert: () => {} } as never,
			project: { get: () => project } as never,
			workspace: {
				get: () => null,
				getMaxAttempt: () => 0,
				upsert: () => {},
			} as never,
			workspaceRepo: { upsert: () => {} } as never,
			session: { upsert: () => {} } as never,
			codingAgentTurn: {
				findLatestResumeInfoByWorkspaceId: () => null,
				upsert: () => {},
			} as never,
			codingAgentProcess: { upsert: () => {} } as never,
			agentSetting: defaultAgentSetting,
			variant: {
				get: () => ({
					id: "variant-3",
					executor: "claude-code",
					name: "OPUS",
					permissionMode: "default",
					model: "opus",
					appendPrompt: null,
					createdAt: new Date(),
					updatedAt: new Date(),
				}),
			} as never,
			worktree: createMockWorktreeRepository(),
			workspaceConfig: defaultWorkspaceConfig,
			scriptRunner: defaultScriptRunner,
			workspaceScriptProcess: { upsert: () => {} } as never,
			workspaceScriptProcessLogs: { upsertLogs: () => {} } as never,
			executor: {
				startProtocol: async (opts: { model?: string }) => {
					capturedModel = opts.model;
					return {
						id: "exec-12",
						sessionId: "session-12",
						runReason: "codingagent",
						startedAt: new Date(),
					};
				},
			} as never,
		});

		await startExecution(task.id, {
			variant: "OPUS",
			model: "sonnet", // should be overridden by variant
		}).run(ctx);

		expect(capturedModel).toBe("opus");
	});

	// ===== Error Cases =====

	test("returns NOT_FOUND when task does not exist", async () => {
		const ctx = createMockContext({
			task: { get: () => null } as never,
		});

		const result = await startExecution("non-existent").run(ctx);

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.code).toBe("NOT_FOUND");
			expect(result.error.message).toContain("Task not found");
		}
	});

	test("returns NOT_FOUND when project does not exist", async () => {
		const task = createTestTask();

		const ctx = createMockContext({
			task: { get: () => task, upsert: () => {} } as never,
			project: { get: () => null } as never,
		});

		const result = await startExecution(task.id).run(ctx);

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.code).toBe("NOT_FOUND");
			expect(result.error.message).toContain("Project not found");
		}
	});

	test("returns WORKTREE_ERROR when worktree creation fails", async () => {
		const task = createTestTask({ title: "Test Task" });
		const project = createTestProject({ id: task.projectId });

		const ctx = createMockContext({
			task: { get: () => task, upsert: () => {} } as never,
			project: { get: () => project } as never,
			workspace: {
				get: () => null,
				getMaxAttempt: () => 0,
				upsert: () => {},
			} as never,
			workspaceRepo: { upsert: () => {} } as never,
			session: { upsert: () => {} } as never,
			codingAgentTurn: {
				findLatestResumeInfoByWorkspaceId: () => null,
				upsert: () => {},
			} as never,
			codingAgentProcess: { upsert: () => {} } as never,
			agentSetting: defaultAgentSetting,
			worktree: createMockWorktreeRepositoryCreationFails("Permission denied"),
			workspaceConfig: defaultWorkspaceConfig,
			scriptRunner: defaultScriptRunner,
		});

		const result = await startExecution(task.id).run(ctx);

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.code).toBe("WORKTREE_ERROR");
			expect(result.error.message).toContain("Permission denied");
		}
	});

	test("returns INVALID_INPUT when task has no title", async () => {
		const task = createTestTask({ title: "", description: undefined });
		const project = createTestProject({ id: task.projectId });

		const ctx = createMockContext({
			task: { get: () => task, upsert: () => {} } as never,
			project: { get: () => project } as never,
			workspace: {
				get: () => null,
				getMaxAttempt: () => 0,
				upsert: () => {},
			} as never,
			workspaceRepo: { upsert: () => {} } as never,
			session: { upsert: () => {} } as never,
			codingAgentTurn: {
				findLatestResumeInfoByWorkspaceId: () => null,
				upsert: () => {},
			} as never,
			codingAgentProcess: { upsert: () => {} } as never,
			agentSetting: defaultAgentSetting,
			worktree: createMockWorktreeRepository(),
			workspaceConfig: defaultWorkspaceConfig,
			scriptRunner: defaultScriptRunner,
		});

		const result = await startExecution(task.id).run(ctx);

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.code).toBe("INVALID_INPUT");
		}
	});

	// ===== Target Branch =====

	test("uses targetBranch when provided", async () => {
		const task = createTestTask({ title: "Test Task" });
		const project = createTestProject({
			id: task.projectId,
			branch: "main",
		});

		let upsertedWorkspaceRepo: { targetBranch?: string } | null = null;

		const ctx = createMockContext({
			task: { get: () => task, upsert: () => {} } as never,
			project: { get: () => project } as never,
			workspace: {
				get: () => null,
				getMaxAttempt: () => 0,
				upsert: () => {},
			} as never,
			workspaceRepo: {
				upsert: (wr: { targetBranch?: string }) => {
					upsertedWorkspaceRepo = wr;
				},
			} as never,
			session: { upsert: () => {} } as never,
			codingAgentTurn: {
				findLatestResumeInfoByWorkspaceId: () => null,
				upsert: () => {},
			} as never,
			codingAgentProcess: { upsert: () => {} } as never,
			agentSetting: defaultAgentSetting,
			worktree: createMockWorktreeRepository(),
			workspaceConfig: defaultWorkspaceConfig,
			scriptRunner: defaultScriptRunner,
			workspaceScriptProcess: { upsert: () => {} } as never,
			workspaceScriptProcessLogs: { upsertLogs: () => {} } as never,
			executor: {
				startProtocol: async () => ({
					id: "exec-7",
					sessionId: "session-7",
					runReason: "codingagent",
					startedAt: new Date(),
				}),
			} as never,
		});

		await startExecution(task.id, {
			targetBranch: "feature/custom-branch",
		}).run(ctx);

		const wr1 = upsertedWorkspaceRepo as unknown as {
			targetBranch?: string;
		};
		expect(wr1?.targetBranch).toBe("feature/custom-branch");
	});

	test("falls back to project.branch when targetBranch not provided", async () => {
		const task = createTestTask({ title: "Test Task" });
		const project = createTestProject({
			id: task.projectId,
			branch: "develop",
		});

		let upsertedWorkspaceRepo: { targetBranch?: string } | null = null;

		const ctx = createMockContext({
			task: { get: () => task, upsert: () => {} } as never,
			project: { get: () => project } as never,
			workspace: {
				get: () => null,
				getMaxAttempt: () => 0,
				upsert: () => {},
			} as never,
			workspaceRepo: {
				upsert: (wr: { targetBranch?: string }) => {
					upsertedWorkspaceRepo = wr;
				},
			} as never,
			session: { upsert: () => {} } as never,
			codingAgentTurn: {
				findLatestResumeInfoByWorkspaceId: () => null,
				upsert: () => {},
			} as never,
			codingAgentProcess: { upsert: () => {} } as never,
			agentSetting: defaultAgentSetting,
			worktree: createMockWorktreeRepository(),
			workspaceConfig: defaultWorkspaceConfig,
			scriptRunner: defaultScriptRunner,
			workspaceScriptProcess: { upsert: () => {} } as never,
			workspaceScriptProcessLogs: { upsertLogs: () => {} } as never,
			executor: {
				startProtocol: async () => ({
					id: "exec-8",
					sessionId: "session-8",
					runReason: "codingagent",
					startedAt: new Date(),
				}),
			} as never,
		});

		await startExecution(task.id).run(ctx);

		const wr2 = upsertedWorkspaceRepo as unknown as {
			targetBranch?: string;
		};
		expect(wr2?.targetBranch).toBe("develop");
	});

	// ===== Prepare Script =====

	test("runs prepare script when configured and succeeds", async () => {
		const task = createTestTask({ title: "Test Task" });
		const project = createTestProject({ id: task.projectId });

		let executorCalled = false;
		let prepareProcessUpserted = false;
		let prepareLogsUpserted = false;

		const ctx = createMockContext({
			task: { get: () => task, upsert: () => {} } as never,
			project: { get: () => project } as never,
			workspace: {
				get: () => null,
				getMaxAttempt: () => 0,
				upsert: () => {},
			} as never,
			workspaceRepo: { upsert: () => {} } as never,
			session: { upsert: () => {} } as never,
			codingAgentTurn: {
				findLatestResumeInfoByWorkspaceId: () => null,
				upsert: () => {},
			} as never,
			codingAgentProcess: { upsert: () => {} } as never,
			agentSetting: defaultAgentSetting,
			worktree: createMockWorktreeRepository(),
			workspaceConfig: {
				load: async () => ({
					prepare: "bun install",
					server: null,
					cleanup: null,
				}),
			} as never,
			scriptRunner: {
				run: async () => ({
					exitCode: 0,
					stdout: "installed",
					stderr: "",
				}),
			} as never,
			workspaceScriptProcess: {
				upsert: () => {
					prepareProcessUpserted = true;
				},
			} as never,
			workspaceScriptProcessLogs: {
				upsertLogs: () => {
					prepareLogsUpserted = true;
				},
			} as never,
			executor: {
				startProtocol: async () => {
					executorCalled = true;
					return {
						id: "exec-prep-1",
						sessionId: "session-prep-1",
						runReason: "codingagent",
						startedAt: new Date(),
					};
				},
			} as never,
		});

		const result = await startExecution(task.id).run(ctx);

		expect(result.ok).toBe(true);
		expect(executorCalled).toBe(true);
		expect(prepareProcessUpserted).toBe(true);
		expect(prepareLogsUpserted).toBe(true);
	});

	test("returns PREPARE_SCRIPT_FAILED when prepare script fails", async () => {
		const task = createTestTask({ title: "Test Task" });
		const project = createTestProject({ id: task.projectId });

		let executorCalled = false;

		const ctx = createMockContext({
			task: { get: () => task, upsert: () => {} } as never,
			project: { get: () => project } as never,
			workspace: {
				get: () => null,
				getMaxAttempt: () => 0,
				upsert: () => {},
			} as never,
			workspaceRepo: { upsert: () => {} } as never,
			session: { upsert: () => {} } as never,
			codingAgentTurn: {
				findLatestResumeInfoByWorkspaceId: () => null,
				upsert: () => {},
			} as never,
			codingAgentProcess: { upsert: () => {} } as never,
			agentSetting: defaultAgentSetting,
			worktree: createMockWorktreeRepository(),
			workspaceConfig: {
				load: async () => ({
					prepare: "exit 1",
					server: null,
					cleanup: null,
				}),
			} as never,
			scriptRunner: {
				run: async () => ({
					exitCode: 1,
					stdout: "",
					stderr: "install failed",
				}),
			} as never,
			workspaceScriptProcess: { upsert: () => {} } as never,
			workspaceScriptProcessLogs: { upsertLogs: () => {} } as never,
			executor: {
				startProtocol: async () => {
					executorCalled = true;
					return {
						id: "exec-prep-2",
						sessionId: "session-prep-2",
						runReason: "codingagent",
						startedAt: new Date(),
					};
				},
			} as never,
		});

		const result = await startExecution(task.id).run(ctx);

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.code).toBe("PREPARE_SCRIPT_FAILED");
		}
		// Agent should NOT have been started
		expect(executorCalled).toBe(false);
	});

	test("skips prepare when no prepare command configured", async () => {
		const task = createTestTask({ title: "Test Task" });
		const project = createTestProject({ id: task.projectId });

		let scriptRunnerCalled = false;

		const ctx = createMockContext({
			task: { get: () => task, upsert: () => {} } as never,
			project: { get: () => project } as never,
			workspace: {
				get: () => null,
				getMaxAttempt: () => 0,
				upsert: () => {},
			} as never,
			workspaceRepo: { upsert: () => {} } as never,
			session: { upsert: () => {} } as never,
			codingAgentTurn: {
				findLatestResumeInfoByWorkspaceId: () => null,
				upsert: () => {},
			} as never,
			codingAgentProcess: { upsert: () => {} } as never,
			agentSetting: defaultAgentSetting,
			worktree: createMockWorktreeRepository(),
			workspaceConfig: defaultWorkspaceConfig,
			scriptRunner: {
				run: async () => {
					scriptRunnerCalled = true;
					return { exitCode: 0, stdout: "", stderr: "" };
				},
			} as never,
			workspaceScriptProcess: { upsert: () => {} } as never,
			workspaceScriptProcessLogs: { upsertLogs: () => {} } as never,
			executor: {
				startProtocol: async () => ({
					id: "exec-prep-3",
					sessionId: "session-prep-3",
					runReason: "codingagent",
					startedAt: new Date(),
				}),
			} as never,
		});

		const result = await startExecution(task.id).run(ctx);

		expect(result.ok).toBe(true);
		expect(scriptRunnerCalled).toBe(false);
	});
});
