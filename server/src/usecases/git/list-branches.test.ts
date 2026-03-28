import { describe, expect, test } from "bun:test";
import { createTestProject } from "../../../test/factories";
import { createMockContext } from "../../../test/helpers/context";
import { createMockGitRepository } from "../../../test/helpers/git";
import { listBranches } from "./list-branches";

describe("listBranches", () => {
	test("returns branch list for valid project", async () => {
		const project = createTestProject();
		const branches = [
			{ name: "main", isCurrent: false },
			{ name: "develop", isCurrent: true },
			{ name: "feature/test", isCurrent: false },
		];

		const ctx = createMockContext({
			project: { get: () => project } as never,
			git: createMockGitRepository({
				listBranches: async () => branches,
			}),
		});

		const result = await listBranches({
			projectId: project.id,
		}).run(ctx);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.branches).toHaveLength(3);
			expect(result.value.branches[0].name).toBe("main");
			expect(result.value.branches[1].isCurrent).toBe(true);
		}
	});

	test("returns empty list when no branches", async () => {
		const project = createTestProject();

		const ctx = createMockContext({
			project: { get: () => project } as never,
			git: createMockGitRepository({
				listBranches: async () => [],
			}),
		});

		const result = await listBranches({
			projectId: project.id,
		}).run(ctx);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.branches).toHaveLength(0);
		}
	});

	test("returns NOT_FOUND when project does not exist", async () => {
		const ctx = createMockContext({
			project: { get: () => null } as never,
		});

		const result = await listBranches({
			projectId: "non-existent",
		}).run(ctx);

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.code).toBe("NOT_FOUND");
			expect(result.error.message).toContain("Project not found");
		}
	});

	test("uses project repoPath for listing branches", async () => {
		const project = createTestProject({ repoPath: "/custom/repo/path" });

		let capturedPath: string | undefined;

		const ctx = createMockContext({
			project: { get: () => project } as never,
			git: createMockGitRepository({
				listBranches: async (path: string) => {
					capturedPath = path;
					return [];
				},
			}),
		});

		await listBranches({ projectId: project.id }).run(ctx);

		expect(capturedPath).toBe("/custom/repo/path");
	});
});
