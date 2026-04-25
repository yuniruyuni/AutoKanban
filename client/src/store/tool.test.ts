import { beforeEach, describe, expect, test } from "vitest";
import { type Tool, toolActions, toolStore } from "./tool";

const makeTool = (overrides: Partial<Tool> = {}): Tool => ({
	id: "tool-1",
	name: "Build",
	icon: "wrench",
	iconColor: "#000",
	command: "bun build",
	argv: null,
	sortOrder: 1,
	createdAt: "2024-01-01T00:00:00Z",
	updatedAt: "2024-01-01T00:00:00Z",
	...overrides,
});

describe("toolStore", () => {
	beforeEach(() => {
		toolStore.tools = [];
	});

	describe("setTools", () => {
		test("replaces tools array", () => {
			toolActions.setTools([makeTool({ id: "a" }), makeTool({ id: "b" })]);
			expect(toolStore.tools).toHaveLength(2);
			expect(toolStore.tools[0].id).toBe("a");
		});
	});

	describe("addTool", () => {
		test("adds tool and sorts by sortOrder", () => {
			toolActions.addTool(makeTool({ id: "a", sortOrder: 2 }));
			toolActions.addTool(makeTool({ id: "b", sortOrder: 1 }));
			expect(toolStore.tools[0].id).toBe("b");
			expect(toolStore.tools[1].id).toBe("a");
		});

		test("lower sortOrder comes first", () => {
			toolActions.addTool(makeTool({ id: "high", sortOrder: 10 }));
			toolActions.addTool(makeTool({ id: "low", sortOrder: 0 }));
			expect(toolStore.tools[0].id).toBe("low");
		});
	});

	describe("updateTool", () => {
		test("merges partial updates", () => {
			toolActions.setTools([makeTool({ id: "tool-1", name: "Old" })]);
			toolActions.updateTool("tool-1", { name: "New" });
			expect(toolStore.tools[0].name).toBe("New");
		});

		test("re-sorts after sortOrder change", () => {
			toolActions.setTools([
				makeTool({ id: "a", sortOrder: 1 }),
				makeTool({ id: "b", sortOrder: 2 }),
			]);
			toolActions.updateTool("a", { sortOrder: 3 });
			expect(toolStore.tools[0].id).toBe("b");
			expect(toolStore.tools[1].id).toBe("a");
		});

		test("no-op for non-existent ID", () => {
			toolActions.setTools([makeTool({ id: "tool-1" })]);
			toolActions.updateTool("nonexistent", { name: "Nope" });
			expect(toolStore.tools).toHaveLength(1);
			expect(toolStore.tools[0].name).toBe("Build");
		});
	});

	describe("removeTool", () => {
		test("removes tool by ID", () => {
			toolActions.setTools([makeTool({ id: "a" }), makeTool({ id: "b" })]);
			toolActions.removeTool("a");
			expect(toolStore.tools).toHaveLength(1);
			expect(toolStore.tools[0].id).toBe("b");
		});

		test("no-op for non-existent ID", () => {
			toolActions.setTools([makeTool({ id: "a" })]);
			toolActions.removeTool("nonexistent");
			expect(toolStore.tools).toHaveLength(1);
		});
	});

	describe("sort invariant", () => {
		test("maintains sort order after multiple addTool calls", () => {
			toolActions.addTool(makeTool({ id: "c", sortOrder: 3 }));
			toolActions.addTool(makeTool({ id: "a", sortOrder: 1 }));
			toolActions.addTool(makeTool({ id: "b", sortOrder: 2 }));
			expect(toolStore.tools.map((t) => t.id)).toEqual(["a", "b", "c"]);
		});
	});
});
