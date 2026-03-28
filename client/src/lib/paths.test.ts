import { describe, expect, test } from "vitest";
import { paths } from "./paths";

describe("paths", () => {
	describe("home", () => {
		test("returns root path", () => {
			expect(paths.home()).toBe("/");
		});
	});

	describe("newProject", () => {
		test("returns new project path", () => {
			expect(paths.newProject()).toBe("/projects/new");
		});
	});

	describe("project", () => {
		test("returns project path with id", () => {
			expect(paths.project("proj-1")).toBe("/projects/proj-1");
		});
	});

	describe("task", () => {
		test("returns task path with project and task ids", () => {
			expect(paths.task("proj-1", "task-1")).toBe(
				"/projects/proj-1/tasks/task-1",
			);
		});
	});

	describe("taskFullscreen", () => {
		test("returns fullscreen task path", () => {
			expect(paths.taskFullscreen("proj-1", "task-1")).toBe(
				"/projects/proj-1/tasks/task-1/fullscreen",
			);
		});
	});

	describe("settings", () => {
		test("returns settings path", () => {
			expect(paths.settings()).toBe("/settings");
		});
	});

	describe("tools", () => {
		test("returns tools settings path", () => {
			expect(paths.tools()).toBe("/settings/tools");
		});
	});

	describe("mcpServer", () => {
		test("returns MCP server settings path", () => {
			expect(paths.mcpServer()).toBe("/settings/mcp-server");
		});
	});

	describe("agent", () => {
		test("returns agent settings path", () => {
			expect(paths.agent()).toBe("/settings/agent");
		});
	});

	describe("agentDetail", () => {
		test("returns agent detail path with id", () => {
			expect(paths.agentDetail("agent-1")).toBe("/settings/agent/agent-1");
		});
	});

	describe("edge cases", () => {
		test("handles IDs with special characters", () => {
			expect(paths.project("id-with-special/chars")).toBe(
				"/projects/id-with-special/chars",
			);
		});

		test("handles empty string IDs", () => {
			expect(paths.project("")).toBe("/projects/");
			expect(paths.task("", "")).toBe("/projects//tasks/");
		});
	});
});
