import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { TaskDetailPanel } from "./TaskDetailPanel";

// Mock stores - must be before vi.mock due to hoisting
vi.mock("@/store", () => ({
	taskStore: {
		tasks: [
			{
				id: "task-1",
				projectId: "project-1",
				title: "Test Task",
				description: "Test description",
				status: "inprogress",
				createdAt: new Date().toISOString(),
				updatedAt: new Date().toISOString(),
			},
		],
	},
	uiStore: {},
	executionStore: { activeExecutions: {} },
	toolStore: { tools: [] },
	uiActions: {
		openEditTask: vi.fn(),
		openStartAgentDialog: vi.fn(),
		openConfirmDialog: vi.fn(),
		closeTaskDetail: vi.fn(),
	},
	executionActions: {
		updateExecutionStatus: vi.fn(),
	},
}));

// Mock valtio useSnapshot
vi.mock("valtio", () => ({
	useSnapshot: (store: unknown) => store,
}));

// Mock hooks
vi.mock("@/hooks/useExecution", () => ({
	useExecution: () => ({
		stop: vi.fn(),
		isStopping: false,
	}),
	useExecutionStatus: () => ({
		executionProcess: null,
	}),
}));

vi.mock("@/hooks/useLatestExecution", () => ({
	useLatestExecution: vi.fn(),
}));

vi.mock("@/hooks/useTaskMutations", () => ({
	useTaskMutations: () => ({
		createTask: vi.fn(),
		updateTask: vi.fn(),
		deleteTask: vi.fn(),
		isCreating: false,
		isUpdating: false,
		isDeleting: false,
	}),
}));

// Mock useFollowUp hook to avoid complex trpc mocking
vi.mock("@/hooks/useFollowUp", () => ({
	useFollowUp: () => ({
		send: vi.fn(),
		queue: vi.fn(),
		cancelQueue: vi.fn(),
		queuedMessage: null,
		hasQueuedMessage: false,
		isSending: false,
		isQueueing: false,
		isCancelling: false,
	}),
}));

vi.mock("@/hooks/useVariants", () => ({
	useVariants: () => ({
		variants: [
			{ id: "v1", name: "DEFAULT", permissionMode: "bypassPermissions" },
		],
		isLoading: false,
	}),
}));

// Mock trpc
vi.mock("@/trpc", () => ({
	trpc: {
		execution: {
			getStructuredLogs: {
				useQuery: () => ({ data: null }),
			},
			getPendingPermissions: {
				useQuery: () => ({ data: null }),
			},
			saveDraft: {
				useMutation: () => ({ mutate: vi.fn() }),
			},
			getDraft: {
				useQuery: () => ({ data: null }),
			},
		},
		approval: {
			getPending: {
				useQuery: () => ({ data: null }),
			},
		},
		tool: {
			execute: {
				useMutation: () => ({ mutateAsync: vi.fn() }),
			},
		},
	},
}));

describe("TaskDetailPanel", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	test("does not render tool buttons when no tools registered", () => {
		render(<TaskDetailPanel taskId="task-1" />);

		// With no tools registered, no tool buttons should appear
		const buttons = screen.getAllByRole("button");
		// Only Edit, Delete task, Fullscreen-less buttons should exist (no tool buttons)
		const toolButtons = buttons.filter((b) => {
			const title = b.getAttribute("title");
			return title && title !== "Open fullscreen" && title !== "Delete task";
		});
		expect(toolButtons).toHaveLength(0);
	});

	test("task title has correct styling (text-lg)", () => {
		render(<TaskDetailPanel taskId="task-1" />);

		const title = screen.getByText("Test Task");
		expect(title).toHaveClass("text-lg", "font-semibold");
	});

	test("status badge has rounded corners (cornerRadius 4px)", () => {
		render(<TaskDetailPanel taskId="task-1" />);

		const badge = screen.getByText("In Progress");
		expect(badge).toHaveClass("rounded");
		expect(badge).not.toHaveClass("rounded-full");
	});

	test("renders Delete button", () => {
		render(<TaskDetailPanel taskId="task-1" />);

		const deleteButton = screen.getByTitle("Delete task");
		expect(deleteButton).toBeInTheDocument();
	});

	test("renders Close button when onClose provided", () => {
		const onClose = vi.fn();
		render(<TaskDetailPanel taskId="task-1" onClose={onClose} />);

		// Find the close button (X icon)
		const buttons = screen.getAllByRole("button");
		const closeButton = buttons.find((b) => {
			const svg = b.querySelector("svg");
			return svg !== null;
		});

		expect(closeButton).toBeInTheDocument();
	});

	test("renders Fullscreen button when onOpenFullscreen provided", () => {
		const onOpenFullscreen = vi.fn();
		render(
			<TaskDetailPanel taskId="task-1" onOpenFullscreen={onOpenFullscreen} />,
		);

		const fullscreenButton = screen.getByTitle("Open fullscreen");
		expect(fullscreenButton).toBeInTheDocument();
	});

	test("renders component structure", () => {
		render(<TaskDetailPanel taskId="task-1" />);

		// Verify basic component structure
		expect(screen.getByText("Task Details")).toBeInTheDocument();
		expect(screen.getByText("Test Task")).toBeInTheDocument();
	});
});
