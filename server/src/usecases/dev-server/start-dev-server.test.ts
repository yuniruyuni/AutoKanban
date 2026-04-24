import { describe, expect, test } from "bun:test";
import {
	createTestProject,
	createTestSession,
	createTestTask,
	createTestWorkspace,
} from "../../../test/factories";
import { createMockContext } from "../../../test/helpers/context";
import { startDevServer } from "./start-dev-server";

/**
 * Guards the two lifecycle invariants behind the Preview feature:
 *   1. The DevServerProcess row is committed to the DB before spawn, so the
 *      dev_server_process_logs FK is satisfied when the first stdout chunk
 *      arrives.
 *   2. The spawn tells DevServerRepository it is a "devserver" process, so
 *      the completion callback later updates DevServerProcess (not some
 *      other process table).
 */

function buildCtx(overrides?: {
	hasRunningDevServer?: boolean;
	serverCommand?: string | null;
}) {
	const task = createTestTask();
	const project = createTestProject({ id: task.projectId });
	const workspace = createTestWorkspace({
		taskId: task.id,
		worktreePath: "/tmp/wt",
	});
	const session = createTestSession({ workspaceId: workspace.id });

	const order: string[] = [];
	const startCalls: Array<{
		processType: string;
		processId: string;
		context: { taskId: string; workspaceId: string; projectId: string };
	}> = [];

	const ctx = createMockContext({
		task: { get: async () => task },
		project: { get: async () => project },
		workspace: { get: async () => workspace },
		session: {
			list: async () => ({ items: [session], hasMore: false }),
		},
		devServerProcess: {
			list: async () => ({
				items: overrides?.hasRunningDevServer
					? [{ id: "running-dev-server" }]
					: [],
				hasMore: false,
			}),
			upsert: async (p: { id: string }) => {
				order.push(`upsert:${p.id}`);
			},
		},
		worktree: {
			getWorktreePath: () => "/tmp/wt",
		},
		workspaceConfig: {
			load: async () => ({
				prepare: null,
				server:
					overrides?.serverCommand === undefined
						? "bun run start:dev"
						: overrides.serverCommand,
				cleanup: null,
			}),
		},
		devServer: {
			start: (opts: {
				processId: string;
				processType: string;
				context: { taskId: string; workspaceId: string; projectId: string };
			}) => {
				order.push(`spawn:${opts.processId}`);
				startCalls.push({
					processType: opts.processType,
					processId: opts.processId,
					context: opts.context,
				});
			},
		},
	} as never);

	return { ctx, task, order, startCalls };
}

describe("startDevServer", () => {
	test("persists the DevServerProcess row BEFORE spawning", async () => {
		const { ctx, task, order } = buildCtx();

		const result = await startDevServer(task.id).run(ctx);

		expect(result.ok).toBe(true);
		expect(order.length).toBe(2);
		expect(order[0].startsWith("upsert:")).toBe(true);
		expect(order[1].startsWith("spawn:")).toBe(true);
		expect(order[0].slice("upsert:".length)).toBe(
			order[1].slice("spawn:".length),
		);
	});

	test("passes processType: 'devserver' to devServer.start", async () => {
		const { ctx, task, startCalls } = buildCtx();

		await startDevServer(task.id).run(ctx);

		expect(startCalls.length).toBe(1);
		expect(startCalls[0].processType).toBe("devserver");
	});

	test("forwards task / workspace / project ids as spawn context", async () => {
		const { ctx, task, startCalls } = buildCtx();

		await startDevServer(task.id).run(ctx);

		expect(startCalls.length).toBe(1);
		const ctxArg = startCalls[0].context;
		expect(ctxArg.taskId).toBe(task.id);
		expect(typeof ctxArg.workspaceId).toBe("string");
		expect(typeof ctxArg.projectId).toBe("string");
		expect(ctxArg.workspaceId.length).toBeGreaterThan(0);
		expect(ctxArg.projectId.length).toBeGreaterThan(0);
	});

	test("returns the existing process id when one is already running", async () => {
		const { ctx, task, order } = buildCtx({ hasRunningDevServer: true });

		const result = await startDevServer(task.id).run(ctx);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.executionProcessId).toBe("running-dev-server");
		}
		// No upsert and no spawn when we short-circuit to the existing row.
		expect(order.length).toBe(0);
	});

	test("returns INVALID_STATE when auto-kanban.json has no server script", async () => {
		const { ctx, task } = buildCtx({ serverCommand: null });

		const result = await startDevServer(task.id).run(ctx);

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.code).toBe("INVALID_STATE");
			expect(result.error.message).toMatch(/server/);
		}
	});
});
