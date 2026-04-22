import { describe, expect, test } from "bun:test";
import { createTestTask } from "../../../test/factories";
import { createMockContext } from "../../../test/helpers/context";
import type { Page } from "../../models/common";
import type { Task } from "../../models/task";
import { listTasks } from "./list-tasks";

function createMockPage(tasks: Task[]): Page<Task> {
	return { items: tasks, hasMore: false, nextCursor: undefined };
}

describe("listTasks", () => {
	test("lists tasks for a project", async () => {
		const tasks = [createTestTask(), createTestTask()];
		const ctx = createMockContext({
			task: {
				list: () => createMockPage(tasks),
			} as never,
		});

		const result = await listTasks("p1").run(ctx);
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.items).toHaveLength(2);
		}
	});

	test("passes status filter to spec", async () => {
		let receivedSpec: unknown = null;
		const ctx = createMockContext({
			task: {
				list: (spec: unknown) => {
					receivedSpec = spec;
					return createMockPage([]);
				},
			} as never,
		});

		await listTasks("p1", { status: "todo" }).run(ctx);
		expect(receivedSpec).not.toBeNull();
	});

	test("handles array of statuses", async () => {
		let receivedSpec: unknown = null;
		const ctx = createMockContext({
			task: {
				list: (spec: unknown) => {
					receivedSpec = spec;
					return createMockPage([]);
				},
			} as never,
		});

		await listTasks("p1", { status: ["todo", "inprogress"] }).run(ctx);
		expect(receivedSpec).not.toBeNull();
	});

	test("defaults limit to 50", async () => {
		let receivedCursor: { limit: number } | null = null;
		const ctx = createMockContext({
			task: {
				list: (_spec: unknown, cursor: { limit: number }) => {
					receivedCursor = cursor;
					return createMockPage([]);
				},
			} as never,
		});

		await listTasks("p1").run(ctx);
		const cursor1 = receivedCursor as unknown as { limit: number };
		expect(cursor1?.limit).toBe(50);
	});

	test("respects custom limit", async () => {
		let receivedCursor: { limit: number } | null = null;
		const ctx = createMockContext({
			task: {
				list: (_spec: unknown, cursor: { limit: number }) => {
					receivedCursor = cursor;
					return createMockPage([]);
				},
			} as never,
		});

		await listTasks("p1", undefined, { limit: 10 }).run(ctx);
		const cursor2 = receivedCursor as unknown as { limit: number };
		expect(cursor2?.limit).toBe(10);
	});

	test("returns pagination info", async () => {
		const ctx = createMockContext({
			task: {
				list: () => ({
					items: [],
					hasMore: true,
					nextCursor: { createdAt: "2025-01-01" },
				}),
			} as never,
		});

		const result = await listTasks("p1").run(ctx);
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.hasMore).toBe(true);
		}
	});
});
