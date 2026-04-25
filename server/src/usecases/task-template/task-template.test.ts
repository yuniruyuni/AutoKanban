import { describe, expect, test } from "bun:test";
import { createTestTaskTemplate } from "../../../test/factories";
import { createMockContext } from "../../../test/helpers/context";
import { TaskTemplate } from "../../models/task-template";
import { createTaskTemplate } from "./create-task-template";
import { deleteTaskTemplate } from "./delete-task-template";
import { listTaskTemplates } from "./list-task-templates";
import { updateTaskTemplate } from "./update-task-template";

// ============================================
// listTaskTemplates
// ============================================

describe("listTaskTemplates", () => {
	test("returns all templates", async () => {
		const templates = [
			createTestTaskTemplate({ title: "First", sortOrder: 0 }),
			createTestTaskTemplate({ title: "Second", sortOrder: 1 }),
		];

		const ctx = createMockContext({
			taskTemplate: {
				listAll: () => templates,
			} as never,
		});

		const result = await listTaskTemplates().run(ctx);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.templates).toHaveLength(2);
			expect(result.value.templates[0].title).toBe("First");
			expect(result.value.templates[1].title).toBe("Second");
		}
	});

	test("returns empty array when no templates exist", async () => {
		const ctx = createMockContext({
			taskTemplate: {
				listAll: () => [],
			} as never,
		});

		const result = await listTaskTemplates().run(ctx);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.templates).toHaveLength(0);
		}
	});
});

// ============================================
// createTaskTemplate
// ============================================

describe("createTaskTemplate", () => {
	test("creates a template with specified fields", async () => {
		let upserted: TaskTemplate | null = null;

		const ctx = createMockContext({
			taskTemplate: {
				upsert: (t: TaskTemplate) => {
					upserted = t;
				},
			} as never,
		});

		const template = TaskTemplate.create({
			title: "My Template",
			description: "A description",
			condition: "no_dev_server",
			sortOrder: 3,
		});
		const result = await createTaskTemplate(template).run(ctx);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.title).toBe("My Template");
			expect(result.value.description).toBe("A description");
			expect(result.value.condition).toBe("no_dev_server");
			expect(result.value.sortOrder).toBe(3);
		}
		expect(upserted).not.toBeNull();
		expect((upserted as TaskTemplate | null)?.title).toBe("My Template");
	});

	test("returns INVALID_INPUT when title is empty", async () => {
		const ctx = createMockContext();

		const template = TaskTemplate.create({ title: "" });
		const result = await createTaskTemplate(template).run(ctx);

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.code).toBe("INVALID_INPUT");
			expect(result.error.message).toContain("Title is required");
		}
	});

	test("returns INVALID_INPUT when title is whitespace only", async () => {
		const ctx = createMockContext();

		const template = TaskTemplate.create({ title: "   " });
		const result = await createTaskTemplate(template).run(ctx);

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.code).toBe("INVALID_INPUT");
		}
	});
});

// ============================================
// updateTaskTemplate
// ============================================

describe("updateTaskTemplate", () => {
	test("updates specified fields and preserves others", async () => {
		const existing = createTestTaskTemplate({
			title: "OLD",
			description: "OldDesc",
			sortOrder: 1,
		});
		let upserted: TaskTemplate | null = null;

		const ctx = createMockContext({
			taskTemplate: {
				get: () => existing,
				upsert: (t: TaskTemplate) => {
					upserted = t;
				},
			} as never,
		});

		const result = await updateTaskTemplate(existing.id, {
			title: "NEW",
		}).run(ctx);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.title).toBe("NEW");
			expect(result.value.description).toBe("OldDesc");
			expect(result.value.sortOrder).toBe(1);
			expect(result.value.id).toBe(existing.id);
		}
		expect((upserted as TaskTemplate | null)?.title).toBe("NEW");
	});

	test("allows setting description to null", async () => {
		const existing = createTestTaskTemplate({ description: "has text" });

		const ctx = createMockContext({
			taskTemplate: {
				get: () => existing,
				upsert: () => {},
			} as never,
		});

		const result = await updateTaskTemplate(existing.id, {
			description: null,
		}).run(ctx);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.description).toBeNull();
		}
	});

	test("returns NOT_FOUND for non-existent template", async () => {
		const ctx = createMockContext({
			taskTemplate: { get: () => null } as never,
		});

		const result = await updateTaskTemplate("nope", { title: "X" }).run(ctx);

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.code).toBe("NOT_FOUND");
			expect(result.error.message).toContain("Task template not found");
		}
	});
});

// ============================================
// deleteTaskTemplate
// ============================================

describe("deleteTaskTemplate", () => {
	test("deletes an existing template", async () => {
		const existing = createTestTaskTemplate();
		let deletedSpec: unknown = null;

		const ctx = createMockContext({
			taskTemplate: {
				get: () => existing,
				delete: (spec: { id?: string }) => {
					deletedSpec = spec;
					return 1;
				},
			} as never,
		});

		const result = await deleteTaskTemplate(existing.id).run(ctx);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.deleted).toBe(true);
		}
		expect((deletedSpec as { id?: string } | null)?.id).toBe(existing.id);
	});

	test("returns NOT_FOUND for non-existent template", async () => {
		const ctx = createMockContext({
			taskTemplate: { get: () => null } as never,
		});

		const result = await deleteTaskTemplate("nope").run(ctx);

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.code).toBe("NOT_FOUND");
		}
	});
});
