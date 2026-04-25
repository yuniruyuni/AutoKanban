import { describe, expect, test } from "bun:test";
import { createTestTool } from "../../../test/factories";
import { createMockContext } from "../../../test/helpers/context";
import { Tool } from "../../models/tool";
import { createTool } from "./create-tool";
import { deleteTool } from "./delete-tool";
import { listTools } from "./list-tools";
import { updateTool } from "./update-tool";

// ============================================
// listTools
// ============================================

describe("listTools", () => {
	test("returns all tools", async () => {
		const tools = [
			createTestTool({ name: "First" }),
			createTestTool({ name: "Second" }),
		];

		const ctx = createMockContext({
			tool: {
				listAll: () => tools,
			} as never,
		});

		const result = await listTools().run(ctx);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.items).toHaveLength(2);
			expect(result.value.items[0].name).toBe("First");
		}
	});

	test("returns empty array when no tools exist", async () => {
		const ctx = createMockContext({
			tool: {
				listAll: () => [],
			} as never,
		});

		const result = await listTools().run(ctx);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.items).toHaveLength(0);
		}
	});
});

// ============================================
// createTool
// ============================================

describe("createTool", () => {
	test("persists the tool and returns it", async () => {
		let upserted: Tool | null = null;

		const ctx = createMockContext({
			tool: {
				upsert: (t: Tool) => {
					upserted = t;
				},
			} as never,
		});

		const tool = Tool.create({
			name: "Lint",
			icon: "wrench",
			iconColor: "#ff0000",
			command: "bun run lint",
		});
		const result = await createTool(tool).run(ctx);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.name).toBe("Lint");
			expect(result.value.command).toBe("bun run lint");
			expect(result.value.iconColor).toBe("#ff0000");
		}
		expect(upserted).not.toBeNull();
		expect((upserted as Tool | null)?.id).toBe(tool.id);
	});
});

// ============================================
// updateTool
// ============================================

describe("updateTool", () => {
	test("updates specified fields and preserves others", async () => {
		const existing = createTestTool({
			name: "OLD",
			icon: "hammer",
			command: "old cmd",
			iconColor: "#111111",
		});
		let upserted: Tool | null = null;

		const ctx = createMockContext({
			tool: {
				get: () => existing,
				upsert: (t: Tool) => {
					upserted = t;
				},
			} as never,
		});

		const result = await updateTool(existing.id, {
			name: "NEW",
			command: "new cmd",
		}).run(ctx);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.name).toBe("NEW");
			expect(result.value.command).toBe("new cmd");
			expect(result.value.icon).toBe("hammer");
			expect(result.value.iconColor).toBe("#111111");
			expect(result.value.id).toBe(existing.id);
		}
		expect((upserted as Tool | null)?.name).toBe("NEW");
	});

	test("returns NOT_FOUND for non-existent tool", async () => {
		const ctx = createMockContext({
			tool: { get: () => null } as never,
		});

		const result = await updateTool("nope", { name: "X" }).run(ctx);

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.code).toBe("NOT_FOUND");
			expect(result.error.message).toContain("Tool not found");
		}
	});
});

// ============================================
// deleteTool
// ============================================

describe("deleteTool", () => {
	test("deletes an existing tool", async () => {
		const existing = createTestTool();
		let deletedSpec: unknown = null;

		const ctx = createMockContext({
			tool: {
				get: () => existing,
				delete: (spec: { id?: string }) => {
					deletedSpec = spec;
					return 1;
				},
			} as never,
		});

		const result = await deleteTool(existing.id).run(ctx);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.success).toBe(true);
		}
		expect((deletedSpec as { id?: string } | null)?.id).toBe(existing.id);
	});

	test("returns NOT_FOUND for non-existent tool", async () => {
		const ctx = createMockContext({
			tool: { get: () => null } as never,
		});

		const result = await deleteTool("nope").run(ctx);

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.code).toBe("NOT_FOUND");
		}
	});
});
