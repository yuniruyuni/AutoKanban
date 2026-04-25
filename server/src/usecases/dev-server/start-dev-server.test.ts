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
	/**
	 * Override what the proxy's start callback returns. Useful for simulating
	 * the rare race case where Bun.serve had to fall back to a different
	 * port than the one stamped during `write`.
	 */
	proxyStart?: (
		processId: string,
		preferredPort?: number,
	) => Promise<{ port: number }>;
}) {
	const task = createTestTask();
	const project = createTestProject({ id: task.projectId });
	const workspace = createTestWorkspace({
		taskId: task.id,
		worktreePath: "/tmp/wt",
	});
	const session = createTestSession({ workspaceId: workspace.id });

	const order: string[] = [];
	const upsertedPorts: Array<{ id: string; port: number }> = [];
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
			upsert: async (p: { id: string; proxyPort: number }) => {
				order.push(`upsert:${p.id}`);
				upsertedPorts.push({ id: p.id, port: p.proxyPort });
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
		previewProxy: {
			// Proxy lifecycle hooks during the post step — tests only need the
			// start() spy to be callable; target routing is covered in the
			// preview-proxy repo test.
			start:
				overrides?.proxyStart ??
				(async (
					_processId: string,
					preferredPort?: number,
				): Promise<{ port: number }> => ({ port: preferredPort ?? 0 })),
			stop: () => false,
			setTarget: () => {},
			getTarget: () => null,
		},
	} as never);

	return { ctx, task, order, startCalls, upsertedPorts };
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

	// Rare-but-possible: findFreePort wins port X, but between `write` and
	// post's bind another listener steals X. previewProxy.start rebinds on a
	// fresh port and reports it back; the usecase must reconcile the DB row
	// so the client doesn't keep pointing iframes at a dead port.
	test("reconciles the DB row when previewProxy.start falls back to a different port", async () => {
		const { ctx, task, upsertedPorts } = buildCtx({
			proxyStart: async () => ({ port: 9999 }),
		});

		const result = await startDevServer(task.id).run(ctx);

		expect(result.ok).toBe(true);
		// First upsert (write step) carries the port reserved in pre.
		// Second upsert (finish step) carries the port the proxy actually bound.
		expect(upsertedPorts.length).toBe(2);
		expect(upsertedPorts[1].port).toBe(9999);
		expect(upsertedPorts[0].id).toBe(upsertedPorts[1].id);
	});

	test("does not re-upsert when the proxy bound the originally-reserved port", async () => {
		const { ctx, task, upsertedPorts } = buildCtx({
			// Echo back the preferred port — the common case.
			proxyStart: async (_id, port) => ({ port: port ?? 0 }),
		});

		const result = await startDevServer(task.id).run(ctx);

		expect(result.ok).toBe(true);
		expect(upsertedPorts.length).toBe(1);
	});
});
