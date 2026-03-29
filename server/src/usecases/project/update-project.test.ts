import { describe, expect, test } from "bun:test";
import { createTestProject } from "../../../test/factories";
import { createMockContext } from "../../../test/helpers/context";
import { updateProject } from "./update-project";

describe("updateProject", () => {
	test("updates project name", async () => {
		const project = createTestProject();
		const ctx = createMockContext({
			project: {
				get: () => project,
				upsert: () => {},
			} as never,
		});

		const result = await updateProject({
			projectId: project.id,
			name: "New Name",
		}).run(ctx);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.name).toBe("New Name");
		}
	});

	test("updates description", async () => {
		const project = createTestProject();
		const ctx = createMockContext({
			project: {
				get: () => project,
				upsert: () => {},
			} as never,
		});

		const result = await updateProject({
			projectId: project.id,
			description: "New description",
		}).run(ctx);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.description).toBe("New description");
		}
	});

	test("returns NOT_FOUND for non-existent project", async () => {
		const ctx = createMockContext({
			project: { get: () => null } as never,
		});

		const result = await updateProject({
			projectId: "non-existent",
			name: "X",
		}).run(ctx);

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.code).toBe("NOT_FOUND");
		}
	});

	test("preserves unchanged fields", async () => {
		const project = createTestProject({
			name: "Original",
			description: "Original desc",
		});
		const ctx = createMockContext({
			project: {
				get: () => project,
				upsert: () => {},
			} as never,
		});

		const result = await updateProject({
			projectId: project.id,
			name: "Updated",
		}).run(ctx);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.name).toBe("Updated");
			expect(result.value.description).toBe("Original desc");
		}
	});
});
