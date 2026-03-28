import { beforeEach, describe, expect, test } from "bun:test";
import {
	createTestProject,
	createTestTask,
	createTestTool,
	createTestWorkspace,
} from "../../../test/factories";
import { createMockContext } from "../../../test/helpers/context";
import { executeTool } from "./execute-tool";

// Capture executeCommand calls to verify command/cwd without spawning real processes
let executeCommandCalls: Array<{ command: string; cwd?: string }> = [];

function createToolRepoMock(tool: ReturnType<typeof createTestTool> | null) {
	return {
		get: () => tool,
		executeCommand: (command: string, cwd?: string) => {
			executeCommandCalls.push({ command, cwd });
		},
	} as never;
}

describe("executeTool", () => {
	beforeEach(() => {
		executeCommandCalls = [];
	});

	describe("input validation", () => {
		test("fails when neither taskId nor projectId is provided", async () => {
			const ctx = createMockContext();

			const result = await executeTool({ toolId: "tool-1" }).run(ctx);

			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error.code).toBe("INVALID_INPUT");
			}
		});

		test("fails when tool is not found", async () => {
			const ctx = createMockContext({
				tool: createToolRepoMock(null),
			});

			const result = await executeTool({
				toolId: "nonexistent",
				projectId: "p1",
			}).run(ctx);

			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error.code).toBe("NOT_FOUND");
			}
		});

		test("fails when task is not found", async () => {
			const tool = createTestTool({ command: "echo test" });
			const ctx = createMockContext({
				tool: createToolRepoMock(tool),
				task: { get: () => null } as never,
			});

			const result = await executeTool({
				toolId: tool.id,
				taskId: "nonexistent",
			}).run(ctx);

			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error.code).toBe("NOT_FOUND");
			}
		});

		test("fails when project is not found (via taskId)", async () => {
			const tool = createTestTool({ command: "echo test" });
			const task = createTestTask({ id: "task-1", projectId: "proj-1" });
			const ctx = createMockContext({
				tool: createToolRepoMock(tool),
				task: { get: () => task } as never,
				project: { get: () => null } as never,
			});

			const result = await executeTool({
				toolId: tool.id,
				taskId: task.id,
			}).run(ctx);

			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error.code).toBe("NOT_FOUND");
			}
		});

		test("fails when project is not found (via projectId)", async () => {
			const tool = createTestTool({ command: "echo test" });
			const ctx = createMockContext({
				tool: createToolRepoMock(tool),
				project: { get: () => null } as never,
			});

			const result = await executeTool({
				toolId: tool.id,
				projectId: "nonexistent",
			}).run(ctx);

			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error.code).toBe("NOT_FOUND");
			}
		});
	});

	describe("path resolution with taskId", () => {
		test("uses worktree path when workspace exists", async () => {
			const tool = createTestTool({ command: "code {path}" });
			const task = createTestTask({ id: "task-1", projectId: "proj-1" });
			const project = createTestProject({
				id: "proj-1",
				name: "my-project",
				repoPath: "/repos/my-project",
			});
			const workspace = createTestWorkspace({ id: "ws-1", taskId: "task-1" });

			const ctx = createMockContext({
				tool: createToolRepoMock(tool),
				task: { get: () => task } as never,
				project: { get: () => project } as never,
				workspace: { get: () => workspace } as never,
				worktree: {
					getWorktreePath: () => "/worktrees/ws-1/my-project",
				} as never,
			});

			const result = await executeTool({
				toolId: tool.id,
				taskId: task.id,
			}).run(ctx);

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.command).toBe("code /worktrees/ws-1/my-project");
			}
			// Verify executeCommand received the correct command and cwd
			expect(executeCommandCalls).toHaveLength(1);
			expect(executeCommandCalls[0].command).toBe(
				"code /worktrees/ws-1/my-project",
			);
			expect(executeCommandCalls[0].cwd).toBe("/worktrees/ws-1/my-project");
		});

		test("falls back to project.repoPath when workspace does not exist", async () => {
			const tool = createTestTool({ command: "code {path}" });
			const task = createTestTask({ id: "task-1", projectId: "proj-1" });
			const project = createTestProject({
				id: "proj-1",
				name: "my-project",
				repoPath: "/repos/my-project",
			});

			const ctx = createMockContext({
				tool: createToolRepoMock(tool),
				task: { get: () => task } as never,
				project: { get: () => project } as never,
				workspace: { get: () => null } as never,
			});

			const result = await executeTool({
				toolId: tool.id,
				taskId: task.id,
			}).run(ctx);

			// Must succeed even without workspace — this was a bug where it used to
			// leave targetPath as null, resulting in {path} becoming empty string
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.command).toBe("code /repos/my-project");
			}
			expect(executeCommandCalls).toHaveLength(1);
			expect(executeCommandCalls[0].command).toBe("code /repos/my-project");
			expect(executeCommandCalls[0].cwd).toBe("/repos/my-project");
		});
	});

	describe("path resolution with projectId", () => {
		test("uses project.repoPath when projectId is provided", async () => {
			const tool = createTestTool({ command: "code {path}" });
			const project = createTestProject({
				id: "proj-1",
				repoPath: "/repos/my-project",
			});

			const ctx = createMockContext({
				tool: createToolRepoMock(tool),
				project: { get: () => project } as never,
			});

			const result = await executeTool({
				toolId: tool.id,
				projectId: project.id,
			}).run(ctx);

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.command).toBe("code /repos/my-project");
			}
			expect(executeCommandCalls).toHaveLength(1);
			expect(executeCommandCalls[0].cwd).toBe("/repos/my-project");
		});
	});

	describe("{path} placeholder replacement", () => {
		test("replaces all {path} occurrences in command", async () => {
			const tool = createTestTool({ command: "echo {path} {path}" });
			const project = createTestProject({ id: "proj-1", repoPath: "/my/repo" });

			const ctx = createMockContext({
				tool: createToolRepoMock(tool),
				project: { get: () => project } as never,
			});

			const result = await executeTool({
				toolId: tool.id,
				projectId: project.id,
			}).run(ctx);

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.command).toBe("echo /my/repo /my/repo");
			}
		});

		test("command without {path} placeholder is passed as-is", async () => {
			const tool = createTestTool({ command: "echo hello" });
			const project = createTestProject({ id: "proj-1", repoPath: "/my/repo" });

			const ctx = createMockContext({
				tool: createToolRepoMock(tool),
				project: { get: () => project } as never,
			});

			const result = await executeTool({
				toolId: tool.id,
				projectId: project.id,
			}).run(ctx);

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.command).toBe("echo hello");
			}
		});
	});

	describe("command execution", () => {
		test("calls executeCommand with the resolved command and cwd", async () => {
			const tool = createTestTool({ command: "code {path}" });
			const project = createTestProject({ id: "proj-1", repoPath: "/my/repo" });

			const ctx = createMockContext({
				tool: createToolRepoMock(tool),
				project: { get: () => project } as never,
			});

			const result = await executeTool({
				toolId: tool.id,
				projectId: project.id,
			}).run(ctx);

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.success).toBe(true);
			}
			expect(executeCommandCalls).toHaveLength(1);
			expect(executeCommandCalls[0].command).toBe("code /my/repo");
			expect(executeCommandCalls[0].cwd).toBe("/my/repo");
		});
	});
});
