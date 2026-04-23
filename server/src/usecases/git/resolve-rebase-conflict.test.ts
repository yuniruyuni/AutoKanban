import { describe, expect, test } from "bun:test";
import {
	createTestCodingAgentProcess,
	createTestProject,
	createTestSession,
	createTestWorkspace,
	createTestWorkspaceRepo,
} from "../../../test/factories";
import { createMockContext } from "../../../test/helpers/context";
import {
	buildRebaseConflictPrompt,
	resolveRebaseConflict,
} from "./resolve-rebase-conflict";

// ---------------------------------------------------------------------------
// buildRebaseConflictPrompt
// ---------------------------------------------------------------------------

describe("buildRebaseConflictPrompt", () => {
	test("includes the target branch name", () => {
		const prompt = buildRebaseConflictPrompt("main", ["src/a.ts"]);
		expect(prompt).toContain("`main`");
	});

	test("lists every conflicted file as a bullet", () => {
		const prompt = buildRebaseConflictPrompt("develop", [
			"src/a.ts",
			"src/b.ts",
			"docs/c.md",
		]);
		expect(prompt).toContain("- src/a.ts");
		expect(prompt).toContain("- src/b.ts");
		expect(prompt).toContain("- docs/c.md");
	});

	test("instructs the agent to git add and git rebase --continue", () => {
		const prompt = buildRebaseConflictPrompt("main", ["a"]);
		expect(prompt).toContain("git add");
		expect(prompt).toContain("git rebase --continue");
	});

	test("instructs the agent to escalate to the user when unsure", () => {
		const prompt = buildRebaseConflictPrompt("main", ["a"]);
		// Catch prompt drift that would remove the user-ask fallback.
		expect(prompt).toMatch(/ユーザ/);
		expect(prompt).toMatch(/選択肢/);
	});

	test("instructs the agent to loop when --continue re-conflicts", () => {
		const prompt = buildRebaseConflictPrompt("main", ["a"]);
		expect(prompt).toMatch(/繰り返/);
	});
});

// ---------------------------------------------------------------------------
// resolveRebaseConflict — preconditions
// ---------------------------------------------------------------------------

describe("resolveRebaseConflict preconditions", () => {
	test("returns NOT_FOUND when workspace does not exist", async () => {
		const ctx = createMockContext({
			workspace: { get: async () => null },
		} as never);

		const result = await resolveRebaseConflict("ws-x", "proj-1").run(ctx);

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.code).toBe("NOT_FOUND");
			expect(result.error.message).toContain("Workspace not found");
		}
	});

	test("returns NOT_FOUND when project does not exist", async () => {
		const workspace = createTestWorkspace();
		const ctx = createMockContext({
			workspace: { get: async () => workspace },
			project: { get: async () => null },
		} as never);

		const result = await resolveRebaseConflict(workspace.id, "proj-x").run(ctx);

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.code).toBe("NOT_FOUND");
			expect(result.error.message).toContain("Project not found");
		}
	});

	test("returns INVALID_STATE when workspace has no session", async () => {
		const workspace = createTestWorkspace();
		const project = createTestProject();
		const ctx = createMockContext({
			workspace: { get: async () => workspace },
			project: { get: async () => project },
			session: { list: async () => ({ items: [], hasMore: false }) },
		} as never);

		const result = await resolveRebaseConflict(workspace.id, project.id).run(
			ctx,
		);

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.code).toBe("INVALID_STATE");
			expect(result.error.message).toContain("no session");
		}
	});

	test("returns NOT_FOUND when worktree does not exist", async () => {
		const { ctx } = buildResolveCtx({
			worktreeExists: async () => false,
		});

		const { workspace, project } = testIds;
		const result = await resolveRebaseConflict(workspace, project).run(ctx);

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.code).toBe("NOT_FOUND");
			expect(result.error.message).toContain("Worktree");
		}
	});

	test("returns INVALID_STATE when no rebase is in progress", async () => {
		const { ctx } = buildResolveCtx({
			isRebaseInProgress: async () => false,
		});

		const result = await resolveRebaseConflict(
			testIds.workspace,
			testIds.project,
		).run(ctx);

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.code).toBe("INVALID_STATE");
			expect(result.error.message).toContain("No rebase");
		}
	});

	test("returns INVALID_STATE when rebase is in progress but no conflicts", async () => {
		const { ctx } = buildResolveCtx({
			getConflictedFiles: async () => [],
		});

		const result = await resolveRebaseConflict(
			testIds.workspace,
			testIds.project,
		).run(ctx);

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.code).toBe("INVALID_STATE");
			expect(result.error.message).toMatch(/no conflicts/i);
		}
	});
});

// ---------------------------------------------------------------------------
// resolveRebaseConflict — dispatch paths
// ---------------------------------------------------------------------------

describe("resolveRebaseConflict dispatch", () => {
	test("queues without dispatch when the existing agent is running but busy", async () => {
		let sendMessageCalled = false;
		let startProtocolCalled = false;
		const { ctx, state } = buildResolveCtx({
			latestProcessStatus: "running",
			latestProcessIdle: false,
			onSendMessage: () => {
				sendMessageCalled = true;
				return undefined;
			},
			onStartProtocol: () => {
				startProtocolCalled = true;
			},
		});

		const result = await resolveRebaseConflict(
			testIds.workspace,
			testIds.project,
		).run(ctx);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.sentImmediately).toBe(false);
			expect(result.value.executionProcessId).toBeUndefined();
		}
		expect(sendMessageCalled).toBe(false);
		expect(startProtocolCalled).toBe(false);
		expect(state.queuedMessages.length).toBe(1);
	});

	test("sends to the existing process when the agent is running and idle", async () => {
		let sendMessageCalled = false;
		let startProtocolCalled = false;
		const { ctx, state } = buildResolveCtx({
			latestProcessStatus: "running",
			latestProcessIdle: true,
			onSendMessage: () => {
				sendMessageCalled = true;
				return true;
			},
			onStartProtocol: () => {
				startProtocolCalled = true;
			},
		});

		const result = await resolveRebaseConflict(
			testIds.workspace,
			testIds.project,
		).run(ctx);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.sentImmediately).toBe(true);
			expect(result.value.executionProcessId).toBe(state.latestProcessId);
		}
		expect(sendMessageCalled).toBe(true);
		expect(startProtocolCalled).toBe(false);
	});

	test("starts a fresh protocol (with resume tokens) when the last agent is not running", async () => {
		let startProtocolCalled = false;
		let spawnedPrompt = "";
		const { ctx, state } = buildResolveCtx({
			latestProcessStatus: "killed",
			latestProcessIdle: false,
			resumeInfo: {
				agentSessionId: "resume-session",
				agentMessageId: "resume-msg",
			},
			onStartProtocol: (opts) => {
				startProtocolCalled = true;
				spawnedPrompt = opts.prompt;
			},
		});

		const result = await resolveRebaseConflict(
			testIds.workspace,
			testIds.project,
		).run(ctx);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.sentImmediately).toBe(true);
			expect(result.value.executionProcessId).toBeDefined();
			expect(result.value.executionProcessId).not.toBe(state.latestProcessId);
		}
		expect(startProtocolCalled).toBe(true);
		expect(spawnedPrompt).toContain("main");
		expect(spawnedPrompt).toContain("src/a.ts");
	});

	test("persists the new CodingAgentProcess and CodingAgentTurn via finish", async () => {
		const upsertedProcesses: string[] = [];
		const upsertedTurns: string[] = [];
		const { ctx } = buildResolveCtx({
			latestProcessStatus: "killed",
			resumeInfo: {
				agentSessionId: "resume-session",
				agentMessageId: "resume-msg",
			},
			onUpsertProcess: (p) => {
				upsertedProcesses.push(p.id);
			},
			onUpsertTurn: (t) => {
				upsertedTurns.push(t.id);
			},
		});

		const result = await resolveRebaseConflict(
			testIds.workspace,
			testIds.project,
		).run(ctx);

		expect(result.ok).toBe(true);
		expect(upsertedProcesses.length).toBe(1);
		expect(upsertedTurns.length).toBe(1);
	});

	test("does not persist a new process when message is only queued", async () => {
		const upsertedProcesses: string[] = [];
		const upsertedTurns: string[] = [];
		const { ctx } = buildResolveCtx({
			latestProcessStatus: "running",
			latestProcessIdle: false,
			onUpsertProcess: (p) => {
				upsertedProcesses.push(p.id);
			},
			onUpsertTurn: (t) => {
				upsertedTurns.push(t.id);
			},
		});

		const result = await resolveRebaseConflict(
			testIds.workspace,
			testIds.project,
		).run(ctx);

		expect(result.ok).toBe(true);
		expect(upsertedProcesses.length).toBe(0);
		expect(upsertedTurns.length).toBe(0);
	});
});

describe("resolveRebaseConflict prompt content", () => {
	test("uses the workspace's configured target branch", async () => {
		let spawnedPrompt = "";
		const { ctx } = buildResolveCtx({
			targetBranch: "release/2.0",
			latestProcessStatus: "killed",
			onStartProtocol: (opts) => {
				spawnedPrompt = opts.prompt;
			},
		});

		await resolveRebaseConflict(testIds.workspace, testIds.project).run(ctx);

		expect(spawnedPrompt).toContain("`release/2.0`");
		expect(spawnedPrompt).not.toContain("`main`");
	});

	test("falls back to project.branch when workspaceRepo is absent", async () => {
		let spawnedPrompt = "";
		const { ctx } = buildResolveCtx({
			workspaceRepoItems: [],
			projectBranch: "trunk",
			latestProcessStatus: "killed",
			onStartProtocol: (opts) => {
				spawnedPrompt = opts.prompt;
			},
		});

		await resolveRebaseConflict(testIds.workspace, testIds.project).run(ctx);

		expect(spawnedPrompt).toContain("`trunk`");
	});

	test("includes every conflicted file path in the prompt", async () => {
		let spawnedPrompt = "";
		const files = ["a.ts", "dir/b.ts", "dir/nested/c.ts"];
		const { ctx } = buildResolveCtx({
			conflictedFiles: files,
			latestProcessStatus: "killed",
			onStartProtocol: (opts) => {
				spawnedPrompt = opts.prompt;
			},
		});

		await resolveRebaseConflict(testIds.workspace, testIds.project).run(ctx);

		for (const f of files) {
			expect(spawnedPrompt).toContain(`- ${f}`);
		}
	});
});

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

const testIds = {
	workspace: "test-workspace-id",
	project: "test-project-id",
};

interface ResolveCtxOverrides {
	worktreeExists?: () => Promise<boolean>;
	isRebaseInProgress?: () => Promise<boolean>;
	getConflictedFiles?: () => Promise<string[]>;
	conflictedFiles?: string[];
	targetBranch?: string;
	projectBranch?: string;
	workspaceRepoItems?: Array<{
		id: string;
		workspaceId: string;
		projectId: string;
		targetBranch: string;
	}>;
	latestProcessStatus?: "running" | "completed" | "failed" | "killed" | null;
	latestProcessIdle?: boolean;
	resumeInfo?: {
		agentSessionId: string;
		agentMessageId: string;
	} | null;
	onSendMessage?: () => boolean | undefined;
	onStartProtocol?: (opts: { prompt: string }) => void;
	onUpsertProcess?: (p: { id: string }) => void;
	onUpsertTurn?: (t: { id: string }) => void;
}

function buildResolveCtx(opts: ResolveCtxOverrides = {}) {
	const workspace = createTestWorkspace({ id: testIds.workspace });
	const project = createTestProject({
		id: testIds.project,
		branch: opts.projectBranch ?? "main",
	});
	const session = createTestSession({ workspaceId: workspace.id });
	const latestProcessId = "proc-latest";
	const latestProcess =
		opts.latestProcessStatus === null
			? null
			: createTestCodingAgentProcess({
					id: latestProcessId,
					sessionId: session.id,
					status: opts.latestProcessStatus ?? "running",
				});

	const workspaceRepo = createTestWorkspaceRepo({
		workspaceId: workspace.id,
		projectId: project.id,
		targetBranch: opts.targetBranch ?? "main",
	});
	const workspaceRepoItems =
		opts.workspaceRepoItems !== undefined
			? opts.workspaceRepoItems
			: [workspaceRepo];

	const conflictedFiles = opts.conflictedFiles ?? ["src/a.ts"];

	const queuedMessages: string[] = [];

	const state = {
		workspace,
		project,
		session,
		latestProcessId,
		queuedMessages,
	};

	const ctx = createMockContext({
		workspace: { get: async () => workspace },
		project: { get: async () => project },
		session: {
			list: async () => ({ items: [session], hasMore: false }),
		},
		workspaceRepo: {
			list: async () => ({ items: workspaceRepoItems, hasMore: false }),
		},
		codingAgentProcess: {
			list: async () => ({
				items: latestProcess ? [latestProcess] : [],
				hasMore: false,
			}),
			upsert: async (p: { id: string }) => {
				opts.onUpsertProcess?.(p);
			},
		},
		codingAgentProcessLogs: {
			// parseLogsToConversation expects `[timestamp] [source] data` lines.
			// A `result` message marks the agent idle; an `assistant` message keeps
			// it active.
			getLogs: async () => ({
				codingAgentProcessId: latestProcessId,
				logs: opts.latestProcessIdle
					? '[2026-04-23T10:00:00.000Z] [stdout] {"type":"result","subtype":"success"}\n'
					: '[2026-04-23T10:00:00.000Z] [stdout] {"type":"assistant","message":{"content":[{"type":"text","text":"working"}]}}\n',
			}),
			appendLogs: async () => {},
		},
		codingAgentTurn: {
			findLatestResumeInfo: async () => opts.resumeInfo ?? null,
			upsert: async (t: { id: string }) => {
				opts.onUpsertTurn?.(t);
			},
		},
		variant: {
			get: async () => null,
		},
		agentSetting: {
			get: async () => null,
		},
		worktree: {
			getWorktreePath: () => "/tmp/worktrees/ws/proj",
			worktreeExists: opts.worktreeExists ?? (async () => true),
		},
		git: {
			isRebaseInProgress: opts.isRebaseInProgress ?? (async () => true),
			getConflictedFiles:
				opts.getConflictedFiles ??
				(async () => conflictedFiles ?? ["src/a.ts"]),
		},
		messageQueue: {
			queue: (sessionId: string, prompt: string) => {
				queuedMessages.push(prompt);
				return { sessionId, prompt, queuedAt: new Date() };
			},
			consume: () => undefined,
		},
		logStoreManager: {
			get: () => ({ append: () => {} }),
		},
		executor: {
			sendMessage: async () => {
				const result = opts.onSendMessage?.();
				return result ?? true;
			},
			startProtocol: async (protocolOpts: { prompt: string }) => {
				opts.onStartProtocol?.(protocolOpts);
				return {
					id: "spawned",
					sessionId: session.id,
					runReason: "codingagent",
					startedAt: new Date(),
				};
			},
		},
	} as never);

	return { ctx, state };
}
