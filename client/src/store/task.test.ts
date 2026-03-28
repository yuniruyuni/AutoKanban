import { beforeEach, describe, expect, test } from "vitest";
import { type Task, taskActions, taskStore } from "./task";

const makeTask = (overrides: Partial<Task> = {}): Task => ({
	id: "task-1",
	projectId: "proj-1",
	title: "Test Task",
	description: null,
	status: "todo",
	createdAt: "2024-01-01T00:00:00Z",
	updatedAt: "2024-01-01T00:00:00Z",
	...overrides,
});

describe("taskStore", () => {
	beforeEach(() => {
		taskStore.tasks = [];
		taskStore.selectedTaskId = null;
	});

	describe("setTasks", () => {
		test("replaces tasks array", () => {
			const tasks = [makeTask({ id: "a" }), makeTask({ id: "b" })];
			taskActions.setTasks(tasks);
			expect(taskStore.tasks).toHaveLength(2);
			expect(taskStore.tasks[0].id).toBe("a");
			expect(taskStore.tasks[1].id).toBe("b");
		});

		test("clears with empty array", () => {
			taskActions.setTasks([makeTask()]);
			taskActions.setTasks([]);
			expect(taskStore.tasks).toHaveLength(0);
		});
	});

	describe("selectTask", () => {
		test("sets selected task ID", () => {
			taskActions.selectTask("task-1");
			expect(taskStore.selectedTaskId).toBe("task-1");
		});

		test("clears selection with null", () => {
			taskActions.selectTask("task-1");
			taskActions.selectTask(null);
			expect(taskStore.selectedTaskId).toBeNull();
		});
	});

	describe("addTask", () => {
		test("appends task to end", () => {
			taskActions.addTask(makeTask({ id: "a" }));
			taskActions.addTask(makeTask({ id: "b" }));
			expect(taskStore.tasks).toHaveLength(2);
			expect(taskStore.tasks[1].id).toBe("b");
		});
	});

	describe("updateTask", () => {
		test("merges partial updates", () => {
			taskActions.setTasks([makeTask({ id: "task-1", title: "Original" })]);
			taskActions.updateTask("task-1", { title: "Updated" });
			expect(taskStore.tasks[0].title).toBe("Updated");
		});

		test("preserves other fields", () => {
			taskActions.setTasks([
				makeTask({ id: "task-1", title: "Original", status: "todo" }),
			]);
			taskActions.updateTask("task-1", { status: "inprogress" });
			expect(taskStore.tasks[0].title).toBe("Original");
			expect(taskStore.tasks[0].status).toBe("inprogress");
		});

		test("no-op for non-existent ID", () => {
			taskActions.setTasks([makeTask({ id: "task-1" })]);
			taskActions.updateTask("nonexistent", { title: "Nope" });
			expect(taskStore.tasks).toHaveLength(1);
			expect(taskStore.tasks[0].title).toBe("Test Task");
		});
	});

	describe("removeTask", () => {
		test("removes task by ID", () => {
			taskActions.setTasks([makeTask({ id: "a" }), makeTask({ id: "b" })]);
			taskActions.removeTask("a");
			expect(taskStore.tasks).toHaveLength(1);
			expect(taskStore.tasks[0].id).toBe("b");
		});

		test("no-op for non-existent ID", () => {
			taskActions.setTasks([makeTask({ id: "a" })]);
			taskActions.removeTask("nonexistent");
			expect(taskStore.tasks).toHaveLength(1);
		});

		test("removes from middle of array", () => {
			taskActions.setTasks([
				makeTask({ id: "a" }),
				makeTask({ id: "b" }),
				makeTask({ id: "c" }),
			]);
			taskActions.removeTask("b");
			expect(taskStore.tasks.map((t) => t.id)).toEqual(["a", "c"]);
		});
	});
});
