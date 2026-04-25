import { describe, expect, test } from "bun:test";
import { createTestDevServerProcess } from "../../../test/factories";
import { createMockContext } from "../../../test/helpers/context";
import type { DevServerProcess } from "../../models/dev-server-process";
import { getDevServer } from "./get-dev-server";

describe("getDevServer", () => {
	test("returns the latest dev server process for a session", async () => {
		const ep = createTestDevServerProcess({ sessionId: "sess-1" });

		let receivedSpec: unknown = null;
		const ctx = createMockContext({
			devServerProcess: {
				list: (spec: { sessionId?: string }) => {
					receivedSpec = spec;
					return { items: [ep], hasMore: false };
				},
			} as never,
		});

		const result = await getDevServer("sess-1").run(ctx);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.executionProcess?.id).toBe(ep.id);
		}
		expect((receivedSpec as { sessionId?: string }).sessionId).toBe("sess-1");
	});

	test("returns null when no dev server process exists for the session", async () => {
		const ctx = createMockContext({
			devServerProcess: {
				list: () => ({
					items: [] as DevServerProcess[],
					hasMore: false,
				}),
			} as never,
		});

		const result = await getDevServer("sess-without-server").run(ctx);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.executionProcess).toBeNull();
		}
	});
});
