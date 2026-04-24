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
			context: { taskId: "t1", workspaceId: "w1", projectId: "p1" },
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
			context: { taskId: "t1", workspaceId: "w1", projectId: "p1" },
		});

		await new Promise((r) => setTimeout(r, 150));

		expect(scriptSpy.calls).toContain(processId);
		expect(devSpy.calls).not.toContain(processId);
		expect(received.info?.processType).toBe("workspacescript");
	});

	test("exports AK_* context env vars to the spawned script", async () => {
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

		// Write AK_* env into a file we can read back. The spawn runs in /tmp
		// and emits a JSON line we can parse.
		const tmpDir = `/tmp/ak-env-test-${Date.now()}-${Math.random()
			.toString(36)
			.slice(2, 8)}`;
		await Bun.write(
			`${tmpDir}/.gitkeep`,
			`stub so the dir exists before spawn`,
		);
		const envFile = `${tmpDir}/env.out`;

		const processId = "proc-env-1";
		startedProcessIds.push(processId);
		repo.start(ctx, {
			processId,
			sessionId: "sess-env",
			command: `printf '%s\\n%s\\n%s\\n%s\\n%s\\n%s\\n' "$AK_PROCESS_ID" "$AK_SESSION_ID" "$AK_TASK_ID" "$AK_WORKSPACE_ID" "$AK_PROJECT_ID" "$AK_WORKTREE_PATH" > ${envFile}`,
			workingDir: tmpDir,
			processType: "devserver",
			context: {
				taskId: "task-xyz",
				workspaceId: "ws-xyz",
				projectId: "proj-xyz",
			},
		});

		// Wait for the shell to finish writing.
		await new Promise((r) => setTimeout(r, 200));

		const contents = await Bun.file(envFile).text();
		const lines = contents.trim().split("\n");
		expect(lines[0]).toBe(processId);
		expect(lines[1]).toBe("sess-env");
		expect(lines[2]).toBe("task-xyz");
		expect(lines[3]).toBe("ws-xyz");
		expect(lines[4]).toBe("proj-xyz");
		expect(lines[5]).toBe(tmpDir);
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
			context: { taskId: "t1", workspaceId: "w1", projectId: "p1" },
		});

		await new Promise((r) => setTimeout(r, 150));

		expect(received.info?.status).toBe("failed");
		expect(received.info?.exitCode).toBe(7);
	});
});
