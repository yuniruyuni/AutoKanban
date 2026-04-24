import { afterEach, describe, expect, test } from "bun:test";
import { createMockLogger } from "../../../../test/helpers/logger";
import type { CallbackClient } from "../../../infra/callback/client";
import { createServiceCtx } from "../../common";
import { LogCollector } from "../../log-collector";
import { DevServerRepository } from "./index";

/**
 * The tests here exercise the process-type routing that failed in production:
 * the single repository spawns both dev-server and workspace-script processes,
 * and each needs its logs to land in the corresponding FK-constrained table
 * and its completion callback to carry the correct processType.
 */

const ctx = createServiceCtx();

function collector(spy: { calls: string[] }) {
	const fakeRepo = {
		appendLogs: async (processId: string, _chunk: string) => {
			spy.calls.push(processId);
		},
	} as never;
	return new LogCollector(fakeRepo, createMockLogger());
}

function fakeCallback(received: {
	info: Parameters<CallbackClient["onProcessComplete"]>[0] | null;
}): CallbackClient {
	return {
		onProcessComplete: async (info) => {
			received.info = info;
		},
		onProcessIdle: async () => {},
		onApprovalRequest: async () => {},
		onLogData: async () => {},
		onSessionInfo: async () => {},
		onSummary: async () => {},
	};
}

const startedProcessIds: string[] = [];

afterEach(() => {
	startedProcessIds.length = 0;
});

describe("DevServerRepository.start", () => {
	test("routes dev-server logs to the dev-server collector", async () => {
		const devSpy = { calls: [] as string[] };
		const scriptSpy = { calls: [] as string[] };
		const received = {
			info: null as Parameters<CallbackClient["onProcessComplete"]>[0] | null,
		};

		const repo = new DevServerRepository(
			createMockLogger(),
			{
				devserver: collector(devSpy),
				workspacescript: collector(scriptSpy),
			},
			fakeCallback(received),
		);

		const processId = "proc-dev-1";
		startedProcessIds.push(processId);
		repo.start(ctx, {
			processId,
			sessionId: "sess-1",
			command: 'printf "hello"',
			workingDir: "/tmp",
			processType: "devserver",
		});

		// The spawn produces output async; wait for exit.
		await new Promise((r) => setTimeout(r, 150));

		expect(devSpy.calls).toContain(processId);
		expect(scriptSpy.calls).not.toContain(processId);
		expect(received.info?.processType).toBe("devserver");
		expect(received.info?.processId).toBe(processId);
	});

	test("routes workspace-script logs to the workspace-script collector", async () => {
		const devSpy = { calls: [] as string[] };
		const scriptSpy = { calls: [] as string[] };
		const received = {
			info: null as Parameters<CallbackClient["onProcessComplete"]>[0] | null,
		};

		const repo = new DevServerRepository(
			createMockLogger(),
			{
				devserver: collector(devSpy),
				workspacescript: collector(scriptSpy),
			},
			fakeCallback(received),
		);

		const processId = "proc-script-1";
		startedProcessIds.push(processId);
		repo.start(ctx, {
			processId,
			sessionId: "sess-1",
			command: 'printf "world"',
			workingDir: "/tmp",
			processType: "workspacescript",
		});

		await new Promise((r) => setTimeout(r, 150));

		expect(scriptSpy.calls).toContain(processId);
		expect(devSpy.calls).not.toContain(processId);
		expect(received.info?.processType).toBe("workspacescript");
	});

	test("completion callback reports status: 'failed' on non-zero exit", async () => {
		const devSpy = { calls: [] as string[] };
		const scriptSpy = { calls: [] as string[] };
		const received = {
			info: null as Parameters<CallbackClient["onProcessComplete"]>[0] | null,
		};

		const repo = new DevServerRepository(
			createMockLogger(),
			{
				devserver: collector(devSpy),
				workspacescript: collector(scriptSpy),
			},
			fakeCallback(received),
		);

		const processId = "proc-fail-1";
		startedProcessIds.push(processId);
		repo.start(ctx, {
			processId,
			sessionId: "sess-1",
			command: "exit 7",
			workingDir: "/tmp",
			processType: "devserver",
		});

		await new Promise((r) => setTimeout(r, 150));

		expect(received.info?.status).toBe("failed");
		expect(received.info?.exitCode).toBe(7);
	});
});
