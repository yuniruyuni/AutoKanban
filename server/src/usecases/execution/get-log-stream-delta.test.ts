import { describe, expect, test } from "bun:test";
import { createMockContext } from "../../../test/helpers/context";
import {
	getLogStreamDelta,
	getLogStreamSnapshot,
	type LogStreamState,
} from "./get-log-stream-delta";

/**
 * The SSE log stream is keyed by a single executionProcessId but backed by
 * three separate logs tables (coding-agent / dev-server / workspace-script).
 * The resolver must try each table so Prepare and Preview logs surface in
 * the UI alongside coding-agent logs without requiring the client to know
 * which kind of process it is subscribing to. After the process reaches a
 * terminal status and all buffered logs have been drained the stream must
 * emit a single `done` event so the client can close the connection and
 * the UI can flip `isStreaming` / `isRunning` off.
 */

interface SpyCounters {
	coding: number;
	dev: number;
	script: number;
}

function makeCtx(
	idToLogs: {
		coding?: string | null;
		dev?: string | null;
		script?: string | null;
	},
	status?: {
		coding?: { status: string; exitCode: number | null } | null;
		dev?: { status: string; exitCode: number | null } | null;
		script?: { status: string; exitCode: number | null } | null;
	},
	counters: SpyCounters = { coding: 0, dev: 0, script: 0 },
) {
	return createMockContext({
		codingAgentProcessLogs: {
			getLogs: async () => {
				counters.coding++;
				return idToLogs.coding === undefined
					? null
					: idToLogs.coding === null
						? null
						: { codingAgentProcessId: "x", logs: idToLogs.coding };
			},
		},
		devServerProcessLogs: {
			getLogs: async () => {
				counters.dev++;
				return idToLogs.dev === undefined
					? null
					: idToLogs.dev === null
						? null
						: { devServerProcessId: "x", logs: idToLogs.dev };
			},
		},
		workspaceScriptProcessLogs: {
			getLogs: async () => {
				counters.script++;
				return idToLogs.script === undefined
					? null
					: idToLogs.script === null
						? null
						: { workspaceScriptProcessId: "x", logs: idToLogs.script };
			},
		},
		codingAgentProcess: {
			get: async () => status?.coding ?? null,
		},
		devServerProcess: {
			get: async () => status?.dev ?? null,
		},
		workspaceScriptProcess: {
			get: async () => status?.script ?? null,
		},
	} as never);
}

const runningState: LogStreamState = { offset: 0, isDone: false };

describe("getLogStreamSnapshot", () => {
	test("returns coding-agent logs when present", async () => {
		const counters: SpyCounters = { coding: 0, dev: 0, script: 0 };
		const ctx = makeCtx({ coding: "hello" }, undefined, counters);

		const res = await getLogStreamSnapshot({ executionProcessId: "p" }).run(
			ctx,
		);

		expect(res.ok).toBe(true);
		if (res.ok) {
			expect(res.value.events).toEqual([{ type: "log", data: "hello" }]);
			expect(res.value.state.offset).toBe(5);
			expect(res.value.state.isDone).toBe(false);
		}
		// Short-circuits after the first hit.
		expect(counters.coding).toBe(1);
		expect(counters.dev).toBe(0);
		expect(counters.script).toBe(0);
	});

	test("falls through to dev-server logs when coding-agent has none", async () => {
		const counters: SpyCounters = { coding: 0, dev: 0, script: 0 };
		const ctx = makeCtx(
			{ coding: null, dev: "server up" },
			undefined,
			counters,
		);

		const res = await getLogStreamSnapshot({ executionProcessId: "p" }).run(
			ctx,
		);

		expect(res.ok).toBe(true);
		if (res.ok) {
			expect(res.value.events).toEqual([{ type: "log", data: "server up" }]);
		}
		expect(counters.coding).toBe(1);
		expect(counters.dev).toBe(1);
		expect(counters.script).toBe(0);
	});

	test("falls through to workspace-script logs as the last source", async () => {
		const counters: SpyCounters = { coding: 0, dev: 0, script: 0 };
		const ctx = makeCtx(
			{ coding: null, dev: null, script: "prepare done" },
			undefined,
			counters,
		);

		const res = await getLogStreamSnapshot({ executionProcessId: "p" }).run(
			ctx,
		);

		expect(res.ok).toBe(true);
		if (res.ok) {
			expect(res.value.events).toEqual([{ type: "log", data: "prepare done" }]);
		}
		expect(counters.script).toBe(1);
	});

	test("emits no event when no table has logs for the id", async () => {
		const ctx = makeCtx({ coding: null, dev: null, script: null });

		const res = await getLogStreamSnapshot({ executionProcessId: "p" }).run(
			ctx,
		);

		expect(res.ok).toBe(true);
		if (res.ok) {
			expect(res.value.events).toEqual([]);
			expect(res.value.state.offset).toBe(0);
			expect(res.value.state.isDone).toBe(false);
		}
	});

	test("emits 'done' when the process is already terminal at subscribe time", async () => {
		const ctx = makeCtx(
			{ coding: null, dev: null, script: "prepare finished\n" },
			{ script: { status: "completed", exitCode: 0 } },
		);

		const res = await getLogStreamSnapshot({ executionProcessId: "p" }).run(
			ctx,
		);

		expect(res.ok).toBe(true);
		if (res.ok) {
			expect(res.value.events.length).toBe(2);
			expect(res.value.events[0]).toEqual({
				type: "log",
				data: "prepare finished\n",
			});
			expect(res.value.events[1].type).toBe("done");
			expect(res.value.events[1].data).toEqual({
				status: "completed",
				exitCode: 0,
			});
			expect(res.value.state.isDone).toBe(true);
		}
	});
});

describe("getLogStreamDelta", () => {
	test("emits only the new suffix past the given offset", async () => {
		const ctx = makeCtx({ coding: "hello world" });

		const res = await getLogStreamDelta(
			{ executionProcessId: "p" },
			{ offset: 6, isDone: false },
		).run(ctx);

		expect(res.ok).toBe(true);
		if (res.ok) {
			expect(res.value.events).toEqual([{ type: "log", data: "world" }]);
			expect(res.value.state.offset).toBe(11);
			expect(res.value.state.isDone).toBe(false);
		}
	});

	test("emits no event when logs have not grown and the process is still running", async () => {
		const ctx = makeCtx(
			{ coding: "hello" },
			{ coding: { status: "running", exitCode: null } },
		);

		const res = await getLogStreamDelta(
			{ executionProcessId: "p" },
			{ offset: 5, isDone: false },
		).run(ctx);

		expect(res.ok).toBe(true);
		if (res.ok) {
			expect(res.value.events).toEqual([]);
			expect(res.value.state.isDone).toBe(false);
		}
	});

	test("emits 'done' once caught up with a terminal process", async () => {
		const ctx = makeCtx(
			{ script: "prepare completed\n" },
			{ script: { status: "completed", exitCode: 0 } },
		);

		const res = await getLogStreamDelta(
			{ executionProcessId: "p" },
			{ offset: "prepare completed\n".length, isDone: false },
		).run(ctx);

		expect(res.ok).toBe(true);
		if (res.ok) {
			expect(res.value.events.length).toBe(1);
			expect(res.value.events[0].type).toBe("done");
			expect(res.value.state.isDone).toBe(true);
		}
	});

	test("defers 'done' emission when a terminal process still has unread log tail", async () => {
		const ctx = makeCtx(
			{ script: "prepare completed\n" },
			{ script: { status: "completed", exitCode: 0 } },
		);

		const res = await getLogStreamDelta(
			{ executionProcessId: "p" },
			{ offset: 0, isDone: false },
		).run(ctx);

		expect(res.ok).toBe(true);
		if (res.ok) {
			expect(res.value.events.length).toBe(1);
			expect(res.value.events[0]).toEqual({
				type: "log",
				data: "prepare completed\n",
			});
			// Log emitted this tick — "done" waits for the next so the client
			// never sees "done" before the logs it refers to.
			expect(res.value.state.isDone).toBe(false);
		}
	});

	test("once isDone is set, further deltas are no-ops", async () => {
		const ctx = makeCtx(
			{ script: "prepare completed\n" },
			{ script: { status: "completed", exitCode: 0 } },
		);

		const res = await getLogStreamDelta(
			{ executionProcessId: "p" },
			{ offset: "prepare completed\n".length, isDone: true },
		).run(ctx);

		expect(res.ok).toBe(true);
		if (res.ok) {
			expect(res.value.events).toEqual([]);
			expect(res.value.state.isDone).toBe(true);
		}
	});

	test("reads from dev-server source even for delta", async () => {
		const ctx = makeCtx({ coding: null, dev: "dev line" });

		const res = await getLogStreamDelta(
			{ executionProcessId: "p" },
			runningState,
		).run(ctx);

		expect(res.ok).toBe(true);
		if (res.ok) {
			expect(res.value.events[0]).toEqual({ type: "log", data: "dev line" });
		}
	});
});
