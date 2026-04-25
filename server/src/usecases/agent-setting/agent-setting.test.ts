import { describe, expect, test } from "bun:test";
import { createMockContext } from "../../../test/helpers/context";
import { AgentSetting } from "../../models/agent-setting";
import { getAgentSetting } from "./get-agent-setting";
import { updateAgentSetting } from "./update-agent-setting";

// ============================================
// getAgentSetting
// ============================================

describe("getAgentSetting", () => {
	test("returns both the configured command and the driver default", async () => {
		const setting = AgentSetting.create({
			agentId: "claude-code",
			command: "/usr/local/bin/claude",
		});

		let driverLookup: string | null = null;
		const ctx = createMockContext({
			agentSetting: {
				get: () => setting,
			} as never,
			executor: {
				getDriverInfo: (name: string) => {
					driverLookup = name;
					return { defaultCommand: "claude" };
				},
			} as never,
		});

		const result = await getAgentSetting("claude-code").run(ctx);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.command).toBe("/usr/local/bin/claude");
			expect(result.value.defaultCommand).toBe("claude");
		}
		expect(driverLookup as string | null).toBe("claude-code");
	});

	test("returns null command when no setting is stored", async () => {
		const ctx = createMockContext({
			agentSetting: {
				get: () => null,
			} as never,
			executor: {
				getDriverInfo: () => ({ defaultCommand: "claude" }),
			} as never,
		});

		const result = await getAgentSetting("claude-code").run(ctx);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.command).toBeNull();
			expect(result.value.defaultCommand).toBe("claude");
		}
	});

	test("returns null defaultCommand when driver is unknown", async () => {
		const ctx = createMockContext({
			agentSetting: {
				get: () => null,
			} as never,
			executor: {
				getDriverInfo: () => null,
			} as never,
		});

		const result = await getAgentSetting("unknown").run(ctx);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.command).toBeNull();
			expect(result.value.defaultCommand).toBeNull();
		}
	});
});

// ============================================
// updateAgentSetting
// ============================================

describe("updateAgentSetting", () => {
	test("upserts an AgentSetting with the given agentId and command", async () => {
		let upserted: AgentSetting | null = null;

		const ctx = createMockContext({
			agentSetting: {
				upsert: (s: AgentSetting) => {
					upserted = s;
				},
			} as never,
		});

		const result = await updateAgentSetting(
			"claude-code",
			"/custom/path/claude",
		).run(ctx);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.success).toBe(true);
		}
		expect((upserted as AgentSetting | null)?.agentId).toBe("claude-code");
		expect((upserted as AgentSetting | null)?.command).toBe(
			"/custom/path/claude",
		);
	});
});
