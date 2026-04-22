import { describe, expect, test } from "bun:test";
import { createTestProject } from "../../../test/factories";
import { createMockContext } from "../../../test/helpers/context";
import { Task } from "../../models/task";
import { createTask } from "./create-task";

describe("createTask", () => {
	test("creates a task when project exists", async () => {
		const project = createTestProject();
		const ctx = createMockContext({
			project: {
				get: () => project,
			} as never,
			task: {
				upsert: () => {},
			} as never,
		});

		const task = Task.create({ projectId: project.id, title: "New Task" });
		const result = await createTask(task).run(ctx);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.title).toBe("New Task");
			expect(result.value.status).toBe("todo");
			expect(result.value.projectId).toBe(project.id);
		}
	});

	test("returns NOT_FOUND when project does not exist", async () => {
		const ctx = createMockContext({
			project: {
				get: () => null,
			} as never,
		});

		const task = Task.create({ projectId: "non-existent", title: "New Task" });
		const result = await createTask(task).run(ctx);

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.code).toBe("NOT_FOUND");
		}
	});

	test("creates task with description", async () => {
		const project = createTestProject();
		const ctx = createMockContext({
			project: { get: () => project } as never,
			task: { upsert: () => {} } as never,
		});

		const task = Task.create({
			projectId: project.id,
			title: "Task with desc",
			description: "Some details",
		});
		const result = await createTask(task).run(ctx);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.description).toBe("Some details");
		}
	});

	test("description defaults to null when omitted", async () => {
		const project = createTestProject();
		const ctx = createMockContext({
			project: { get: () => project } as never,
			task: { upsert: () => {} } as never,
		});

		const task = Task.create({ projectId: project.id, title: "Task" });
		const result = await createTask(task).run(ctx);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.description).toBeNull();
		}
	});

	test("calls upsert on task repo", async () => {
		const project = createTestProject();
		let upsertedTask: unknown = null;
		const ctx = createMockContext({
			project: { get: () => project } as never,
			task: {
				upsert: (t: unknown) => {
					upsertedTask = t;
				},
			} as never,
		});

		const task = Task.create({ projectId: project.id, title: "Test" });
		await createTask(task).run(ctx);
		expect(upsertedTask).not.toBeNull();
	});
});
