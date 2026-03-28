import { describe, expect, test } from "bun:test";
import { getActionLabel, mapToolNameToAction } from "./tool-action-mapper";

// ============================================
// mapToolNameToAction
// ============================================

describe("mapToolNameToAction()", () => {
	test("Read maps to file_read", () => {
		const action = mapToolNameToAction("Read", { file_path: "/src/index.ts" });
		expect(action.type).toBe("file_read");
		if (action.type === "file_read") {
			expect(action.path).toBe("/src/index.ts");
		}
	});

	test("Edit maps to file_edit", () => {
		const action = mapToolNameToAction("Edit", {
			file_path: "/src/foo.ts",
			old_string: "old",
			new_string: "new",
		});
		expect(action.type).toBe("file_edit");
		if (action.type === "file_edit") {
			expect(action.path).toBe("/src/foo.ts");
			expect(action.oldString).toBe("old");
			expect(action.newString).toBe("new");
		}
	});

	test("Write maps to file_write", () => {
		const action = mapToolNameToAction("Write", { file_path: "/src/new.ts" });
		expect(action.type).toBe("file_write");
		if (action.type === "file_write") {
			expect(action.path).toBe("/src/new.ts");
		}
	});

	test("Bash maps to command", () => {
		const action = mapToolNameToAction("Bash", { command: "ls -la" });
		expect(action.type).toBe("command");
		if (action.type === "command") {
			expect(action.command).toBe("ls -la");
		}
	});

	test("Grep maps to search", () => {
		const action = mapToolNameToAction("Grep", {
			pattern: "TODO",
			path: "/src",
		});
		expect(action.type).toBe("search");
		if (action.type === "search") {
			expect(action.query).toBe("TODO");
			expect(action.pattern).toBe("TODO");
			expect(action.path).toBe("/src");
		}
	});

	test("Glob maps to search", () => {
		const action = mapToolNameToAction("Glob", { pattern: "**/*.ts" });
		expect(action.type).toBe("search");
		if (action.type === "search") {
			expect(action.query).toBe("**/*.ts");
		}
	});

	test("WebFetch maps to web_fetch", () => {
		const action = mapToolNameToAction("WebFetch", {
			url: "https://example.com",
		});
		expect(action.type).toBe("web_fetch");
		if (action.type === "web_fetch") {
			expect(action.url).toBe("https://example.com");
		}
	});

	test("WebSearch maps to web_fetch with search prefix", () => {
		const action = mapToolNameToAction("WebSearch", { query: "bun test docs" });
		expect(action.type).toBe("web_fetch");
		if (action.type === "web_fetch") {
			expect(action.url).toBe("search: bun test docs");
		}
	});

	test("Task maps to task", () => {
		const action = mapToolNameToAction("Task", {
			prompt: "fix the bug",
			subagent_type: "general-purpose",
		});
		expect(action.type).toBe("task");
		if (action.type === "task") {
			expect(action.description).toBe("fix the bug");
			expect(action.subagentType).toBe("general-purpose");
		}
	});

	test("Task uses description as fallback", () => {
		const action = mapToolNameToAction("Task", { description: "alt desc" });
		expect(action.type).toBe("task");
		if (action.type === "task") {
			expect(action.description).toBe("alt desc");
		}
	});

	test("ExitPlanMode maps to plan", () => {
		const action = mapToolNameToAction("ExitPlanMode", {
			allowedPrompts: [{ tool: "Bash", prompt: "run tests" }],
		});
		expect(action.type).toBe("plan");
		if (action.type === "plan") {
			expect(action.allowedPrompts).toHaveLength(1);
		}
	});

	test("unknown tool maps to generic", () => {
		const action = mapToolNameToAction("UnknownTool", { foo: "bar" });
		expect(action.type).toBe("generic");
		if (action.type === "generic") {
			expect(action.input).toEqual({ foo: "bar" });
		}
	});

	test("missing input fields default to empty strings", () => {
		const action = mapToolNameToAction("Read", {});
		if (action.type === "file_read") {
			expect(action.path).toBe("");
		}
	});

	test("Bash with missing command defaults to empty", () => {
		const action = mapToolNameToAction("Bash", {});
		if (action.type === "command") {
			expect(action.command).toBe("");
		}
	});
});

// ============================================
// getActionLabel
// ============================================

describe("getActionLabel()", () => {
	test("file_read returns path", () => {
		expect(getActionLabel({ type: "file_read", path: "/src/foo.ts" })).toBe(
			"/src/foo.ts",
		);
	});

	test("file_edit returns path", () => {
		expect(getActionLabel({ type: "file_edit", path: "/src/bar.ts" })).toBe(
			"/src/bar.ts",
		);
	});

	test("file_write returns path", () => {
		expect(getActionLabel({ type: "file_write", path: "/src/new.ts" })).toBe(
			"/src/new.ts",
		);
	});

	test("command returns short command", () => {
		expect(getActionLabel({ type: "command", command: "ls -la" })).toBe(
			"ls -la",
		);
	});

	test("command truncates long commands", () => {
		const longCmd = "a".repeat(60);
		const label = getActionLabel({ type: "command", command: longCmd });
		expect(label.length).toBeLessThanOrEqual(53); // 50 + '...'
		expect(label.endsWith("...")).toBe(true);
	});

	test("search returns pattern or query", () => {
		expect(
			getActionLabel({ type: "search", query: "TODO", pattern: "*.ts" }),
		).toBe("*.ts");
		expect(getActionLabel({ type: "search", query: "TODO" })).toBe("TODO");
	});

	test("web_fetch returns url", () => {
		expect(
			getActionLabel({ type: "web_fetch", url: "https://example.com" }),
		).toBe("https://example.com");
	});

	test('task returns subagentType or "task"', () => {
		expect(
			getActionLabel({
				type: "task",
				description: "x",
				subagentType: "explore",
			}),
		).toBe("explore");
		expect(getActionLabel({ type: "task", description: "x" })).toBe("task");
	});

	test('plan returns "Plan"', () => {
		expect(getActionLabel({ type: "plan" })).toBe("Plan");
	});

	test("generic returns empty string", () => {
		expect(getActionLabel({ type: "generic", input: {} })).toBe("");
	});
});
