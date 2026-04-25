import { describe, expect, test } from "bun:test";
import { createTestProject } from "../../../test/factories";
import { createMockContext } from "../../../test/helpers/context";
import type { ProjectWithStats } from "../../models/project";
import { getProject } from "./get-project";

function withStats(
	overrides: Partial<ProjectWithStats> = {},
): ProjectWithStats {
	const project = createTestProject();
	return {
		...project,
		taskStats: { todo: 0, inProgress: 0, inReview: 0, done: 0, cancelled: 0 },
		...overrides,
	};
}

describe("getProject", () => {
	test("returns project with stats when it exists", async () => {
		const project = withStats({
			taskStats: { todo: 2, inProgress: 1, inReview: 0, done: 3, cancelled: 0 },
		});

		let askedFor: string | null = null;
		const ctx = createMockContext({
			project: {
				getWithStats: (projectId: string) => {
					askedFor = projectId;
					return project;
				},
			} as never,
		});

		const result = await getProject(project.id).run(ctx);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.id).toBe(project.id);
			expect(result.value.taskStats.todo).toBe(2);
			expect(result.value.taskStats.done).toBe(3);
		}
		expect(askedFor as string | null).toBe(project.id);
	});

	test("returns NOT_FOUND when project does not exist", async () => {
		const ctx = createMockContext({
			project: {
				getWithStats: () => null,
			} as never,
		});

		const result = await getProject("missing-id").run(ctx);

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.code).toBe("NOT_FOUND");
			expect(result.error.message).toContain("Project not found");
			expect(result.error.details).toEqual({ projectId: "missing-id" });
		}
	});
});
