import { describe, expect, test } from "bun:test";
import { createTestDevServerProcess } from "../../../test/factories";
import { createMockContext } from "../../../test/helpers/context";
import type { DevServerProcess } from "../../models/dev-server-process";
import { stopDevServer } from "./stop-dev-server";

describe("stopDevServer", () => {
	test("marks the process killed and asks the dev server to stop", async () => {
		const running = createTestDevServerProcess({ status: "running" });

		let upserted: DevServerProcess | null = null;
		let stopArg: string | null = null;

		const ctx = createMockContext({
			devServerProcess: {
				get: () => running,
				upsert: (p: DevServerProcess) => {
					upserted = p;
				},
			} as never,
			devServer: {
				stop: (id: string) => {
					stopArg = id;
				},
			} as never,
		});

		const result = await stopDevServer(running.id).run(ctx);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.stopped).toBe(true);
		}
		expect((upserted as DevServerProcess | null)?.status).toBe("killed");
		expect((upserted as DevServerProcess | null)?.completedAt).not.toBeNull();
		expect(stopArg as string | null).toBe(running.id);
	});

	test("returns NOT_FOUND when the process does not exist", async () => {
		const ctx = createMockContext({
			devServerProcess: {
				get: () => null,
			} as never,
		});

		const result = await stopDevServer("missing").run(ctx);

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.code).toBe("NOT_FOUND");
			expect(result.error.message).toContain("Dev server process not found");
		}
	});

	test("returns INVALID_STATE when the process is already completed", async () => {
		const completed = createTestDevServerProcess({ status: "completed" });

		let stopCalled = false;
		const ctx = createMockContext({
			devServerProcess: {
				get: () => completed,
			} as never,
			devServer: {
				stop: () => {
					stopCalled = true;
				},
			} as never,
		});

		const result = await stopDevServer(completed.id).run(ctx);

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.code).toBe("INVALID_STATE");
			expect(result.error.message).toContain("not running");
		}
		expect(stopCalled).toBe(false);
	});

	test("returns INVALID_STATE when the process has been killed", async () => {
		const killed = createTestDevServerProcess({ status: "killed" });

		const ctx = createMockContext({
			devServerProcess: {
				get: () => killed,
			} as never,
		});

		const result = await stopDevServer(killed.id).run(ctx);

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.code).toBe("INVALID_STATE");
		}
	});
});
