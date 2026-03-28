import { beforeEach, describe, expect, test, vi } from "vitest";
import { uiActions, uiStore } from "./ui";

describe("uiStore", () => {
	beforeEach(() => {
		uiStore.isTaskFormOpen = false;
		uiStore.taskFormMode = "create";
		uiStore.editingTaskId = null;

		uiStore.isProjectFormOpen = false;
		uiStore.projectFormMode = "create";
		uiStore.editingProjectId = null;

		uiStore.isConfirmDialogOpen = false;
		uiStore.confirmDialogType = "confirm";
		uiStore.confirmDialogTitle = "Confirm";
		uiStore.confirmDialogMessage = "";
		uiStore.confirmDialogAction = null;
		uiStore.confirmDialogInput = "";

		uiStore.isTaskDetailOpen = false;
		uiStore.detailTaskId = null;

		uiStore.isStartAgentDialogOpen = false;
		uiStore.startAgentTaskId = null;
		uiStore.startAgentProjectId = null;
	});

	// Task form
	describe("openCreateTask", () => {
		test("opens task form in create mode", () => {
			uiActions.openCreateTask();
			expect(uiStore.isTaskFormOpen).toBe(true);
			expect(uiStore.taskFormMode).toBe("create");
			expect(uiStore.editingTaskId).toBeNull();
		});
	});

	describe("openEditTask", () => {
		test("opens task form in edit mode with task ID", () => {
			uiActions.openEditTask("task-1");
			expect(uiStore.isTaskFormOpen).toBe(true);
			expect(uiStore.taskFormMode).toBe("edit");
			expect(uiStore.editingTaskId).toBe("task-1");
		});
	});

	describe("closeTaskForm", () => {
		test("closes form and clears editing ID", () => {
			uiActions.openEditTask("task-1");
			uiActions.closeTaskForm();
			expect(uiStore.isTaskFormOpen).toBe(false);
			expect(uiStore.editingTaskId).toBeNull();
		});
	});

	// Project form
	describe("openCreateProject", () => {
		test("opens project form in create mode", () => {
			uiActions.openCreateProject();
			expect(uiStore.isProjectFormOpen).toBe(true);
			expect(uiStore.projectFormMode).toBe("create");
			expect(uiStore.editingProjectId).toBeNull();
		});
	});

	describe("openEditProject", () => {
		test("opens project form in edit mode with project ID", () => {
			uiActions.openEditProject("proj-1");
			expect(uiStore.isProjectFormOpen).toBe(true);
			expect(uiStore.projectFormMode).toBe("edit");
			expect(uiStore.editingProjectId).toBe("proj-1");
		});
	});

	describe("closeProjectForm", () => {
		test("closes form and clears editing ID", () => {
			uiActions.openEditProject("proj-1");
			uiActions.closeProjectForm();
			expect(uiStore.isProjectFormOpen).toBe(false);
			expect(uiStore.editingProjectId).toBeNull();
		});
	});

	// Confirm dialog
	describe("openConfirmDialog", () => {
		test("opens dialog with message and action", () => {
			const action = vi.fn();
			uiActions.openConfirmDialog("Delete this?", action);
			expect(uiStore.isConfirmDialogOpen).toBe(true);
			expect(uiStore.confirmDialogMessage).toBe("Delete this?");
			expect(uiStore.confirmDialogAction).toBe(action);
		});
	});

	describe("closeConfirmDialog", () => {
		test("closes dialog and clears state", () => {
			uiActions.openConfirmDialog("Delete?", vi.fn());
			uiActions.closeConfirmDialog();
			expect(uiStore.isConfirmDialogOpen).toBe(false);
			expect(uiStore.confirmDialogMessage).toBe("");
			expect(uiStore.confirmDialogAction).toBeNull();
		});
	});

	describe("confirmAction", () => {
		test("calls the action callback then closes dialog", () => {
			const action = vi.fn();
			uiActions.openConfirmDialog("Confirm?", action);
			uiActions.confirmAction();
			expect(action).toHaveBeenCalledOnce();
			expect(uiStore.isConfirmDialogOpen).toBe(false);
			expect(uiStore.confirmDialogAction).toBeNull();
		});

		test("safe when confirmDialogAction is null", () => {
			uiStore.confirmDialogAction = null;
			expect(() => uiActions.confirmAction()).not.toThrow();
		});
	});

	// Task detail panel
	describe("openTaskDetail", () => {
		test("opens task detail with task ID", () => {
			uiActions.openTaskDetail("task-1");
			expect(uiStore.isTaskDetailOpen).toBe(true);
			expect(uiStore.detailTaskId).toBe("task-1");
		});
	});

	describe("closeTaskDetail", () => {
		test("closes panel and clears task ID", () => {
			uiActions.openTaskDetail("task-1");
			uiActions.closeTaskDetail();
			expect(uiStore.isTaskDetailOpen).toBe(false);
			expect(uiStore.detailTaskId).toBeNull();
		});
	});

	// Start Agent dialog
	describe("openStartAgentDialog", () => {
		test("opens dialog with task and project IDs", () => {
			uiActions.openStartAgentDialog("task-1", "proj-1");
			expect(uiStore.isStartAgentDialogOpen).toBe(true);
			expect(uiStore.startAgentTaskId).toBe("task-1");
			expect(uiStore.startAgentProjectId).toBe("proj-1");
		});
	});

	describe("closeStartAgentDialog", () => {
		test("closes dialog and clears IDs", () => {
			uiActions.openStartAgentDialog("task-1", "proj-1");
			uiActions.closeStartAgentDialog();
			expect(uiStore.isStartAgentDialogOpen).toBe(false);
			expect(uiStore.startAgentTaskId).toBeNull();
			expect(uiStore.startAgentProjectId).toBeNull();
		});
	});
});
