import { beforeEach, describe, expect, test } from "bun:test";
import {
	createTestProject,
	createTestTask,
	createTestTool,
	createTestWorkspace,
} from "../../../test/factories";
import { createMockContext } from "../../../test/helpers/context";
import { executeTool } from "./execute-tool";

// Capture executeCommand calls to verify argv/cwd without spawning real processes
let executeCommandCalls: Array<{ argv: string[]; cwd?: string }> = [];

function createToolRepoMock(tool: ReturnType<typeof createTestTool> | null) {
	return {
		get: () => tool,
		executeCommand: (argv: string[], cwd?: string) => {
			executeCommandCalls.push({ argv, cwd });
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

			const result = await executeTool("tool-1").run(ctx);

			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error.code).toBe("INVALID_INPUT");
			}
		});

		test("fails when tool is not found", async () => {
			const ctx = createMockContext({
				tool: createToolRepoMock(null),
			});

			const result = await executeTool("nonexistent", { projectId: "p1" }).run(
				ctx,
			);

			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error.code).toBe("NOT_FOUND");
			}
		});

		test("fails when task is not found", async () => {
			const tool = createTestTool({ argv: ["echo", "test"] });
			const ctx = createMockContext({
				tool: createToolRepoMock(tool),
				task: { get: () => null } as never,
			});

			const result = await executeTool(tool.id, {
				taskId: "nonexistent",
			}).run(ctx);

			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error.code).toBe("NOT_FOUND");
			}
		});

		test("fails when project is not found (via taskId)", async () => {
			const tool = createTestTool({ argv: ["echo", "test"] });
			const task = createTestTask({ id: "task-1", projectId: "proj-1" });
			const ctx = createMockContext({
				tool: createToolRepoMock(tool),
				task: { get: () => task } as never,
				project: { get: () => null } as never,
			});

			const result = await executeTool(tool.id, { taskId: task.id }).run(ctx);

			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error.code).toBe("NOT_FOUND");
			}
		});

		test("fails when project is not found (via projectId)", async () => {
			const tool = createTestTool({ argv: ["echo", "test"] });
			const ctx = createMockContext({
				tool: createToolRepoMock(tool),
				project: { get: () => null } as never,
			});

			const result = await executeTool(tool.id, {
				projectId: "nonexistent",
			}).run(ctx);

			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error.code).toBe("NOT_FOUND");
			}
		});
	});

	describe("argv form (recommended)", () => {
		test("uses worktree path when workspace exists, no shell wrapping", async () => {
			const tool = createTestTool({ argv: ["code", "{path}"] });
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

			const result = await executeTool(tool.id, { taskId: task.id }).run(ctx);

			expect(result.ok).toBe(true);
			expect(executeCommandCalls).toHaveLength(1);
			expect(executeCommandCalls[0].argv).toEqual([
				"code",
				"/worktrees/ws-1/my-project",
			]);
			expect(executeCommandCalls[0].cwd).toBe("/worktrees/ws-1/my-project");
		});

		test("falls back to project.repoPath when workspace does not exist", async () => {
			const tool = createTestTool({ argv: ["code", "{path}"] });
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

			const result = await executeTool(tool.id, { taskId: task.id }).run(ctx);

			expect(result.ok).toBe(true);
			expect(executeCommandCalls).toHaveLength(1);
			expect(executeCommandCalls[0].argv).toEqual([
				"code",
				"/repos/my-project",
			]);
			expect(executeCommandCalls[0].cwd).toBe("/repos/my-project");
		});

		test("uses project.repoPath when projectId is provided", async () => {
			const tool = createTestTool({ argv: ["code", "{path}"] });
			const project = createTestProject({
				id: "proj-1",
				repoPath: "/repos/my-project",
			});

			const ctx = createMockContext({
				tool: createToolRepoMock(tool),
				project: { get: () => project } as never,
			});

			const result = await executeTool(tool.id, {
				projectId: project.id,
			}).run(ctx);

			expect(result.ok).toBe(true);
			expect(executeCommandCalls[0].argv).toEqual([
				"code",
				"/repos/my-project",
			]);
			expect(executeCommandCalls[0].cwd).toBe("/repos/my-project");
		});

		test("substitutes {path} in every arg element where it appears", async () => {
			const tool = createTestTool({
				argv: ["echo", "{path}", "and-{path}-here"],
			});
			const project = createTestProject({ id: "proj-1", repoPath: "/my/repo" });

			const ctx = createMockContext({
				tool: createToolRepoMock(tool),
				project: { get: () => project } as never,
			});

			const result = await executeTool(tool.id, {
				projectId: project.id,
			}).run(ctx);

			expect(result.ok).toBe(true);
			expect(executeCommandCalls[0].argv).toEqual([
				"echo",
				"/my/repo",
				"and-/my/repo-here",
			]);
		});

		test("paths containing whitespace and shell metacharacters are safe", async () => {
			const tool = createTestTool({ argv: ["code", "{path}"] });
			const project = createTestProject({
				id: "proj-1",
				// Realistic-but-pathological: the user named their project oddly,
				// or worktree base happens to contain a space, etc.
				repoPath: "/repos/My Repo; rm -rf $HOME `id`",
			});

			const ctx = createMockContext({
				tool: createToolRepoMock(tool),
				project: { get: () => project } as never,
			});

			const result = await executeTool(tool.id, {
				projectId: project.id,
			}).run(ctx);

			expect(result.ok).toBe(true);
			// The dangerous string is one literal arg — the shell never sees it.
			expect(executeCommandCalls[0].argv).toEqual([
				"code",
				"/repos/My Repo; rm -rf $HOME `id`",
			]);
		});
	});

	describe("legacy command form (string)", () => {
		test("substitutes {path} via sh -c, with the path shell-escaped", async () => {
			const tool = createTestTool({ command: "code {path}", argv: null });
			const project = createTestProject({ id: "proj-1", repoPath: "/my/repo" });

			const ctx = createMockContext({
				tool: createToolRepoMock(tool),
				project: { get: () => project } as never,
			});

			const result = await executeTool(tool.id, {
				projectId: project.id,
			}).run(ctx);

			expect(result.ok).toBe(true);
			expect(executeCommandCalls).toHaveLength(1);
			expect(executeCommandCalls[0].argv).toEqual([
				"sh",
				"-c",
				"code '/my/repo'",
			]);
			expect(executeCommandCalls[0].cwd).toBe("/my/repo");
		});

		test("paths with whitespace / `;` / `$` cannot break out of the placeholder", async () => {
			const tool = createTestTool({ command: "code {path}", argv: null });
			const project = createTestProject({
				id: "proj-1",
				repoPath: "/repos/My Repo; rm -rf $HOME",
			});

			const ctx = createMockContext({
				tool: createToolRepoMock(tool),
				project: { get: () => project } as never,
			});

			const result = await executeTool(tool.id, {
				projectId: project.id,
			}).run(ctx);

			expect(result.ok).toBe(true);
			// `;` and `$HOME` are inside the single-quoted segment, so the shell
			// treats the whole substituted path as a single literal argument.
			expect(executeCommandCalls[0].argv).toEqual([
				"sh",
				"-c",
				"code '/repos/My Repo; rm -rf $HOME'",
			]);
		});

		test("a single-quote in the path is escaped via the '\\''  trick", async () => {
			const tool = createTestTool({ command: "ls {path}", argv: null });
			const project = createTestProject({
				id: "proj-1",
				repoPath: "/it's/here",
			});

			const ctx = createMockContext({
				tool: createToolRepoMock(tool),
				project: { get: () => project } as never,
			});

			const result = await executeTool(tool.id, {
				projectId: project.id,
			}).run(ctx);

			expect(result.ok).toBe(true);
			expect(executeCommandCalls[0].argv).toEqual([
				"sh",
				"-c",
				"ls '/it'\\''s/here'",
			]);
		});

		test("command without {path} is passed as-is via sh -c", async () => {
			const tool = createTestTool({ command: "echo hello", argv: null });
			const project = createTestProject({ id: "proj-1", repoPath: "/my/repo" });

			const ctx = createMockContext({
				tool: createToolRepoMock(tool),
				project: { get: () => project } as never,
			});

			const result = await executeTool(tool.id, {
				projectId: project.id,
			}).run(ctx);

			expect(result.ok).toBe(true);
			expect(executeCommandCalls[0].argv).toEqual(["sh", "-c", "echo hello"]);
		});

		test("empty command yields INVALID_COMMAND", async () => {
			const tool = createTestTool({ command: "   ", argv: null });
			const project = createTestProject({ id: "proj-1", repoPath: "/my/repo" });

			const ctx = createMockContext({
				tool: createToolRepoMock(tool),
				project: { get: () => project } as never,
			});

			const result = await executeTool(tool.id, {
				projectId: project.id,
			}).run(ctx);

			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error.code).toBe("INVALID_COMMAND");
			}
			expect(executeCommandCalls).toHaveLength(0);
		});
	});

	describe("argv vs command precedence", () => {
		test("when both are present, argv wins (no shell)", async () => {
			const tool = createTestTool({
				command: "old {path}",
				argv: ["new", "{path}"],
			});
			const project = createTestProject({ id: "proj-1", repoPath: "/p" });

			const ctx = createMockContext({
				tool: createToolRepoMock(tool),
				project: { get: () => project } as never,
			});

			const result = await executeTool(tool.id, {
				projectId: project.id,
			}).run(ctx);

			expect(result.ok).toBe(true);
			expect(executeCommandCalls[0].argv).toEqual(["new", "/p"]);
		});

		test("empty argv array falls through to legacy command", async () => {
			const tool = createTestTool({
				command: "echo hi",
				argv: [],
			});
			const project = createTestProject({ id: "proj-1", repoPath: "/p" });

			const ctx = createMockContext({
				tool: createToolRepoMock(tool),
				project: { get: () => project } as never,
			});

			const result = await executeTool(tool.id, {
				projectId: project.id,
			}).run(ctx);

			expect(result.ok).toBe(true);
			expect(executeCommandCalls[0].argv).toEqual(["sh", "-c", "echo hi"]);
		});
	});
});
