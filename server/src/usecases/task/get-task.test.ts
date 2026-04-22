import { describe, expect, test } from "bun:test";
import { createTestTask } from "../../../test/factories";
import { createMockContext } from "../../../test/helpers/context";
import { getTask } from "./get-task";

describe("getTask", () => {
	test("returns task when found", async () => {
		const task = createTestTask();
		const ctx = createMockContext({
			task: { get: () => task } as never,
		});

		const result = await getTask(task.id).run(ctx);
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.id).toBe(task.id);
			expect(result.value.title).toBe(task.title);
		}
	});

	test("returns NOT_FOUND when task does not exist", async () => {
		const ctx = createMockContext({
			task: { get: () => null } as never,
		});

		const result = await getTask("non-existent").run(ctx);
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.code).toBe("NOT_FOUND");
		}
	});
});
