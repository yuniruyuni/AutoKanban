import { describe, expect, test } from "bun:test";
import { createTestTask } from "../../../test/factories";
import { createMockContext } from "../../../test/helpers/context";
import { updateTask } from "./update-task";

describe("updateTask", () => {
	test("updates title", async () => {
		const task = createTestTask({ status: "todo" });
		const ctx = createMockContext({
			task: {
				get: () => task,
				upsert: () => {},
			} as never,
		});

		const result = await updateTask(task.id, {
			title: "New Title",
		}).run(ctx);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.title).toBe("New Title");
		}
	});

	test("updates description", async () => {
		const task = createTestTask({ status: "todo" });
		const ctx = createMockContext({
			task: {
				get: () => task,
				upsert: () => {},
			} as never,
		});

		const result = await updateTask(task.id, {
			description: "Updated description",
		}).run(ctx);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.description).toBe("Updated description");
		}
	});

	test("valid status transition succeeds", async () => {
		const task = createTestTask({ status: "todo" });
		const ctx = createMockContext({
			task: {
				get: () => task,
				upsert: () => {},
			} as never,
		});

		const result = await updateTask(task.id, {
			status: "inprogress",
		}).run(ctx);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.status).toBe("inprogress");
		}
	});

	test("returns NOT_FOUND for non-existent task", async () => {
		const ctx = createMockContext({
			task: { get: () => null } as never,
		});

		const result = await updateTask("non-existent", {
			title: "X",
		}).run(ctx);

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.code).toBe("NOT_FOUND");
		}
	});

	test("same status does not trigger transition check", async () => {
		const task = createTestTask({ status: "todo" });
		const ctx = createMockContext({
			task: {
				get: () => task,
				upsert: () => {},
			} as never,
		});

		// Passing the same status should not fail
		const result = await updateTask(task.id, {
			status: "todo",
		}).run(ctx);

		expect(result.ok).toBe(true);
	});

	test("preserves unchanged fields", async () => {
		const task = createTestTask({ status: "todo", description: "original" });
		const ctx = createMockContext({
			task: {
				get: () => task,
				upsert: () => {},
			} as never,
		});

		const result = await updateTask(task.id, {
			title: "New Title",
		}).run(ctx);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.description).toBe("original");
			expect(result.value.status).toBe("todo");
		}
	});

	test("sets description to null explicitly", async () => {
		const task = createTestTask({ status: "todo", description: "has desc" });
		const ctx = createMockContext({
			task: {
				get: () => task,
				upsert: () => {},
			} as never,
		});

		const result = await updateTask(task.id, {
			description: null,
		}).run(ctx);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.description).toBeNull();
		}
	});
});
