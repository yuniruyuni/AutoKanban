import { describe, expect, test } from "bun:test";
import {
	createTestProject,
	createTestTask,
	createTestWorkspace,
} from "../../../test/factories";
import { createMockContext } from "../../../test/helpers/context";
import { findWorkspaceByPath } from "./find-workspace-by-path";

describe("findWorkspaceByPath", () => {
	test("returns workspace + task + project when all exist", async () => {
		const project = createTestProject();
		const task = createTestTask({ projectId: project.id });
		const workspace = createTestWorkspace({
			taskId: task.id,
			worktreePath: "/tmp/wt",
		});

		let lookupPath: string | null = null;
		const ctx = createMockContext({
			workspace: {
				findByWorktreePath: (path: string) => {
					lookupPath = path;
					return workspace;
				},
			} as never,
			task: {
				get: () => task,
			} as never,
			project: {
				get: () => project,
			} as never,
		});

		const result = await findWorkspaceByPath("/tmp/wt").run(ctx);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.workspace.id).toBe(workspace.id);
			expect(result.value.task.id).toBe(task.id);
			expect(result.value.project.id).toBe(project.id);
		}
		expect(lookupPath as string | null).toBe("/tmp/wt");
	});

	test("returns NOT_FOUND when no workspace matches the path", async () => {
		const ctx = createMockContext({
			workspace: {
				findByWorktreePath: () => null,
			} as never,
		});

		const result = await findWorkspaceByPath("/tmp/nope").run(ctx);

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.code).toBe("NOT_FOUND");
			expect(result.error.message).toContain("No workspace found");
		}
	});

	test("returns NOT_FOUND when workspace exists but task is missing", async () => {
		const workspace = createTestWorkspace({ worktreePath: "/tmp/wt" });

		const ctx = createMockContext({
			workspace: {
				findByWorktreePath: () => workspace,
			} as never,
			task: {
				get: () => null,
			} as never,
		});

		const result = await findWorkspaceByPath("/tmp/wt").run(ctx);

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.code).toBe("NOT_FOUND");
			expect(result.error.message).toContain("Task not found");
		}
	});

	test("returns NOT_FOUND when task exists but project is missing", async () => {
		const task = createTestTask();
		const workspace = createTestWorkspace({
			taskId: task.id,
			worktreePath: "/tmp/wt",
		});

		const ctx = createMockContext({
			workspace: {
				findByWorktreePath: () => workspace,
			} as never,
			task: {
				get: () => task,
			} as never,
			project: {
				get: () => null,
			} as never,
		});

		const result = await findWorkspaceByPath("/tmp/wt").run(ctx);

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.code).toBe("NOT_FOUND");
			expect(result.error.message).toContain("Project not found");
		}
	});
});
