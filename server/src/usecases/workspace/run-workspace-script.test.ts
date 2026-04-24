import { describe, expect, test } from "bun:test";
import {
	createTestProject,
	createTestSession,
	createTestTask,
	createTestWorkspace,
} from "../../../test/factories";
import { createMockContext } from "../../../test/helpers/context";
import { runWorkspaceScript } from "./run-workspace-script";

/**
 * Regression tests for the Prepare / Cleanup entry point. In production this
 * spawned via devServer.start() with the default processType "devserver",
 * producing FK violations against dev_server_processes and crashing the
 * server. These tests guard against both that regression and the ordering
 * bug (spawn before DB write) that made the FK race possible.
 */

function buildCtx(overrides?: {
	hasRunningScript?: boolean;
	preparedCommand?: string | null;
	upsertedOrder?: string[];
	startCapture?: {
		calls: Array<{
			processType: string;
			processId: string;
			context: {
				taskId: string;
				workspaceId: string;
				projectId: string;
			};
		}>;
	};
}) {
	const task = createTestTask();
	const project = createTestProject({ id: task.projectId });
	const workspace = createTestWorkspace({
		taskId: task.id,
		worktreePath: "/tmp/wt",
	});
	const session = createTestSession({ workspaceId: workspace.id });

	const upsertedOrder = overrides?.upsertedOrder ?? [];
	const startCapture = overrides?.startCapture ?? { calls: [] };

	const ctx = createMockContext({
		task: { get: async () => task },
		project: { get: async () => project },
		workspace: { get: async () => workspace },
		session: {
			list: async () => ({ items: [session], hasMore: false }),
		},
		workspaceScriptProcess: {
			list: async () => ({
				items: overrides?.hasRunningScript ? [{ id: "stale-running" }] : [],
				hasMore: false,
			}),
			upsert: async (p: { id: string }) => {
				upsertedOrder.push(`upsert:${p.id}`);
			},
		},
		worktree: {
			getWorktreePath: () => "/tmp/wt",
		},
		workspaceConfig: {
			load: async () => ({
				prepare:
					overrides?.preparedCommand === undefined
						? "bun install"
						: overrides.preparedCommand,
				server: null,
				cleanup: null,
			}),
		},
		devServer: {
			start: (opts: {
				processId: string;
				processType: string;
				context: { taskId: string; workspaceId: string; projectId: string };
			}) => {
				upsertedOrder.push(`spawn:${opts.processId}`);
				startCapture.calls.push({
					processType: opts.processType,
					processId: opts.processId,
					context: opts.context,
				});
			},
		},
	} as never);

	return { ctx, task, upsertedOrder, startCapture };
}

describe("runWorkspaceScript (prepare)", () => {
	test("persists the WorkspaceScriptProcess row BEFORE spawning", async () => {
		const { ctx, task, upsertedOrder } = buildCtx();

		const result = await runWorkspaceScript(task.id, "prepare").run(ctx);

		expect(result.ok).toBe(true);
		// Exactly two side-effects and upsert must precede spawn to satisfy the
		// workspace_script_process_logs FK.
		expect(upsertedOrder.length).toBe(2);
		expect(upsertedOrder[0].startsWith("upsert:")).toBe(true);
		expect(upsertedOrder[1].startsWith("spawn:")).toBe(true);
		// Same id on both sides.
		expect(upsertedOrder[0].slice("upsert:".length)).toBe(
			upsertedOrder[1].slice("spawn:".length),
		);
	});

	test("passes processType: 'workspacescript' to devServer.start", async () => {
		const { ctx, task, startCapture } = buildCtx();

		await runWorkspaceScript(task.id, "prepare").run(ctx);

		expect(startCapture.calls.length).toBe(1);
		expect(startCapture.calls[0].processType).toBe("workspacescript");
	});

	test("forwards task / workspace / project ids as spawn context", async () => {
		const { ctx, task, startCapture } = buildCtx();

		await runWorkspaceScript(task.id, "prepare").run(ctx);

		expect(startCapture.calls.length).toBe(1);
		const ctxArg = startCapture.calls[0].context;
		expect(ctxArg.taskId).toBe(task.id);
		// buildCtx's mocks derive workspace / project from factories; just
		// verify they are non-empty strings (the precise ids come from the
		// factory and are asserted in devServer/process/index.test.ts).
		expect(typeof ctxArg.workspaceId).toBe("string");
		expect(typeof ctxArg.projectId).toBe("string");
		expect(ctxArg.workspaceId.length).toBeGreaterThan(0);
		expect(ctxArg.projectId.length).toBeGreaterThan(0);
	});

	test("returns INVALID_STATE when a workspace script is already running", async () => {
		const { ctx, task } = buildCtx({ hasRunningScript: true });

		const result = await runWorkspaceScript(task.id, "prepare").run(ctx);

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.code).toBe("INVALID_STATE");
			expect(result.error.message).toMatch(/already running/);
		}
	});

	test("returns INVALID_STATE when auto-kanban.json has no prepare script", async () => {
		const { ctx, task } = buildCtx({ preparedCommand: null });

		const result = await runWorkspaceScript(task.id, "prepare").run(ctx);

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.code).toBe("INVALID_STATE");
			expect(result.error.message).toMatch(/prepare/);
		}
	});
});
