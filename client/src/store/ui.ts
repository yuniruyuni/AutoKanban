// @specre 01KPPZWHXV5WC3V732NY8CG046
import { proxy } from "valtio";

interface UIState {
	// Task form dialog
	isTaskFormOpen: boolean;
	taskFormMode: "create" | "edit";
	editingTaskId: string | null;

	// Project form dialog
	isProjectFormOpen: boolean;
	projectFormMode: "create" | "edit";
	editingProjectId: string | null;

	// Confirm dialog
	isConfirmDialogOpen: boolean;
	confirmDialogType:
		| "confirm"
		| "stop-and-reset"
		| "reset"
		| "stop"
		| "resume"
		| "delete-project";
	confirmDialogTitle: string;
	confirmDialogMessage: string;
	confirmDialogAction: (() => void) | null;
	/** For resume dialog: the message input value */
	confirmDialogInput: string;
	confirmDialogCheckbox: boolean;

	// Task detail panel
	isTaskDetailOpen: boolean;
	detailTaskId: string | null;

	// Start Agent dialog
	isStartAgentDialogOpen: boolean;
	startAgentTaskId: string | null;
	startAgentProjectId: string | null;

	// Shortcut help overlay
	isShortcutHelpOpen: boolean;

	// Project list keyboard navigation
	focusedProjectId: string | null;
}

export const uiStore = proxy<UIState>({
	isTaskFormOpen: false,
	taskFormMode: "create",
	editingTaskId: null,

	isProjectFormOpen: false,
	projectFormMode: "create",
	editingProjectId: null,

	isConfirmDialogOpen: false,
	confirmDialogType: "confirm",
	confirmDialogTitle: "Confirm",
	confirmDialogMessage: "",
	confirmDialogAction: null,
	confirmDialogInput: "",
	confirmDialogCheckbox: false,

	isTaskDetailOpen: false,
	detailTaskId: null,

	isStartAgentDialogOpen: false,
	startAgentTaskId: null,
	startAgentProjectId: null,

	isShortcutHelpOpen: false,

	focusedProjectId: null,
});

export const uiActions = {
	// Task form
	openCreateTask() {
		uiStore.taskFormMode = "create";
		uiStore.editingTaskId = null;
		uiStore.isTaskFormOpen = true;
	},

	openEditTask(taskId: string) {
		uiStore.taskFormMode = "edit";
		uiStore.editingTaskId = taskId;
		uiStore.isTaskFormOpen = true;
	},

	closeTaskForm() {
		uiStore.isTaskFormOpen = false;
		uiStore.editingTaskId = null;
	},

	// Project form
	openCreateProject() {
		uiStore.projectFormMode = "create";
		uiStore.editingProjectId = null;
		uiStore.isProjectFormOpen = true;
	},

	openEditProject(projectId: string) {
		uiStore.projectFormMode = "edit";
		uiStore.editingProjectId = projectId;
		uiStore.isProjectFormOpen = true;
	},

	closeProjectForm() {
		uiStore.isProjectFormOpen = false;
		uiStore.editingProjectId = null;
	},

	// Confirm dialog
	openConfirmDialog(message: string, action: () => void) {
		uiStore.confirmDialogType = "confirm";
		uiStore.confirmDialogTitle = "Confirm";
		uiStore.confirmDialogMessage = message;
		uiStore.confirmDialogAction = action;
		uiStore.confirmDialogInput = "";
		uiStore.confirmDialogCheckbox = false;
		uiStore.isConfirmDialogOpen = true;
	},

	openTypedConfirmDialog(opts: {
		type: "stop-and-reset" | "reset" | "stop" | "resume" | "delete-project";
		title: string;
		message: string;
		action: () => void;
	}) {
		uiStore.confirmDialogType = opts.type;
		uiStore.confirmDialogTitle = opts.title;
		uiStore.confirmDialogMessage = opts.message;
		uiStore.confirmDialogAction = opts.action;
		uiStore.confirmDialogInput = "";
		uiStore.confirmDialogCheckbox = false;
		uiStore.isConfirmDialogOpen = true;
	},

	setConfirmDialogCheckbox(value: boolean) {
		uiStore.confirmDialogCheckbox = value;
	},

	setConfirmDialogInput(value: string) {
		uiStore.confirmDialogInput = value;
	},

	closeConfirmDialog() {
		uiStore.isConfirmDialogOpen = false;
		uiStore.confirmDialogType = "confirm";
		uiStore.confirmDialogTitle = "Confirm";
		uiStore.confirmDialogMessage = "";
		uiStore.confirmDialogAction = null;
		uiStore.confirmDialogInput = "";
		uiStore.confirmDialogCheckbox = false;
	},

	confirmAction() {
		uiStore.confirmDialogAction?.();
		uiActions.closeConfirmDialog();
	},

	// Task detail panel
	openTaskDetail(taskId: string) {
		uiStore.detailTaskId = taskId;
		uiStore.isTaskDetailOpen = true;
	},

	closeTaskDetail() {
		uiStore.isTaskDetailOpen = false;
		uiStore.detailTaskId = null;
	},

	// Start Agent dialog
	openStartAgentDialog(taskId: string, projectId: string) {
		uiStore.startAgentTaskId = taskId;
		uiStore.startAgentProjectId = projectId;
		uiStore.isStartAgentDialogOpen = true;
	},

	closeStartAgentDialog() {
		uiStore.isStartAgentDialogOpen = false;
		uiStore.startAgentTaskId = null;
		uiStore.startAgentProjectId = null;
	},

	// Shortcut help
	toggleShortcutHelp() {
		uiStore.isShortcutHelpOpen = !uiStore.isShortcutHelpOpen;
	},

	closeShortcutHelp() {
		uiStore.isShortcutHelpOpen = false;
	},

	// Project list keyboard navigation
	focusProject(projectId: string | null) {
		uiStore.focusedProjectId = projectId;
	},
};
