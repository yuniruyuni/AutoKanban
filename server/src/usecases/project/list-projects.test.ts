import { describe, expect, test } from "bun:test";
import { createTestProject } from "../../../test/factories";
import { createMockContext } from "../../../test/helpers/context";
import type { ProjectWithStats } from "../../models/project";
import { listProjects } from "./list-projects";

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

describe("listProjects", () => {
	test("returns all projects with stats", async () => {
		const projects = [
			withStats({
				taskStats: {
					todo: 1,
					inProgress: 0,
					inReview: 0,
					done: 0,
					cancelled: 0,
				},
			}),
			withStats({
				taskStats: {
					todo: 0,
					inProgress: 2,
					inReview: 0,
					done: 1,
					cancelled: 0,
				},
			}),
		];

		const ctx = createMockContext({
			project: {
				listAllWithStats: () => projects,
			} as never,
		});

		const result = await listProjects().run(ctx);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.projects).toHaveLength(2);
			expect(result.value.projects[0].taskStats.todo).toBe(1);
			expect(result.value.projects[1].taskStats.inProgress).toBe(2);
		}
	});

	test("returns empty array when no projects exist", async () => {
		const ctx = createMockContext({
			project: {
				listAllWithStats: () => [],
			} as never,
		});

		const result = await listProjects().run(ctx);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.projects).toHaveLength(0);
		}
	});
});
