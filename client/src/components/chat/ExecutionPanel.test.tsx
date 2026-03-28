import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { ExecutionPanel } from "./ExecutionPanel";

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
		},
		approval: {
			getPending: {
				useQuery: () => ({ data: null }),
			},
		},
	},
}));

// Mock store actions
vi.mock("../../store", () => ({
	executionActions: {
		updateExecutionStatus: vi.fn(),
	},
}));

// Mock useExecutionStatus hook
vi.mock("../../hooks/useExecution", () => ({
	useExecutionStatus: (executionProcessId: string | null) => ({
		executionProcess: executionProcessId
			? { status: "running", id: executionProcessId }
			: null,
	}),
}));

// Mock ChatContainer
vi.mock("../chat", () => ({
	ChatContainer: ({ isRunning }: { isRunning: boolean }) => (
		<div data-testid="chat-container" data-running={isRunning}>
			Mock Chat Container
		</div>
	),
}));

// Mock FollowUpInput
vi.mock("./FollowUpInput", () => ({
	FollowUpInput: () => (
		<div data-testid="follow-up-input">Mock Follow Up Input</div>
	),
}));

// Mock PlanResponseInput
vi.mock("./PlanResponseInput", () => ({
	PlanResponseInput: () => (
		<div data-testid="plan-response-input">Mock Plan Response Input</div>
	),
}));

// Mock PermissionResponseInput
vi.mock("./PermissionResponseInput", () => ({
	PermissionResponseInput: () => (
		<div data-testid="permission-response-input">
			Mock Permission Response Input
		</div>
	),
}));

const defaultProps = {
	taskId: "task-1",
	taskTitle: "Test Task",
	sessionId: "session-1",
	executionProcessId: "exec-1",
	taskStatus: "inprogress" as const,
};

describe("ExecutionPanel", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	test('does not render "Execution" header text', () => {
		render(<ExecutionPanel {...defaultProps} />);

		// The old "Execution" header should not be present
		expect(screen.queryByText("Execution")).not.toBeInTheDocument();
	});

	test('renders chat header with "Claude Code" text', () => {
		render(<ExecutionPanel {...defaultProps} />);

		expect(screen.getByText("Claude Code")).toBeInTheDocument();
	});

	test('renders "C" avatar icon in chat header', () => {
		render(<ExecutionPanel {...defaultProps} />);

		expect(screen.getByText("C")).toBeInTheDocument();
	});

	test("avatar has accent background color", () => {
		render(<ExecutionPanel {...defaultProps} />);

		const avatar = screen.getByText("C").closest("div");
		expect(avatar).toHaveClass("bg-accent");
	});

	test('shows green status indicator and "Running" text when running', () => {
		render(<ExecutionPanel {...defaultProps} />);

		expect(screen.getByText("Running")).toBeInTheDocument();
		// Green dot should be present
		const runningText = screen.getByText("Running");
		expect(runningText).toHaveClass("text-success");
	});

	test('does not show "Running" indicator when not running', () => {
		render(<ExecutionPanel {...defaultProps} executionProcessId={null} />);

		expect(screen.queryByText("Running")).not.toBeInTheDocument();
	});

	test("Stop button appears in chat header when running", () => {
		const onStop = vi.fn();
		render(<ExecutionPanel {...defaultProps} onStop={onStop} />);

		const stopButton = screen.getByText("Stop");
		expect(stopButton).toBeInTheDocument();

		// Stop button should be in the chat header (border-b section)
		const header = stopButton.closest(".border-b");
		expect(header).toBeInTheDocument();
	});

	test('Stop button shows "Stopping..." when isStopping is true', () => {
		const onStop = vi.fn();
		render(
			<ExecutionPanel {...defaultProps} onStop={onStop} isStopping={true} />,
		);

		expect(screen.getByText("Stopping...")).toBeInTheDocument();
	});

	test("does not show Stop button when not running", () => {
		const onStop = vi.fn();
		render(
			<ExecutionPanel
				{...defaultProps}
				executionProcessId={null}
				onStop={onStop}
			/>,
		);

		expect(screen.queryByText("Stop")).not.toBeInTheDocument();
	});

	test("does not render footer with stats (Started, Completed, Exit code)", () => {
		render(<ExecutionPanel {...defaultProps} />);

		expect(screen.queryByText(/Started:/)).not.toBeInTheDocument();
		expect(screen.queryByText(/Completed:/)).not.toBeInTheDocument();
		expect(screen.queryByText(/Exit code:/)).not.toBeInTheDocument();
	});

	test("renders ChatContainer when executionProcessId is provided", () => {
		render(<ExecutionPanel {...defaultProps} />);

		expect(screen.getByTestId("chat-container")).toBeInTheDocument();
	});

	test("renders FollowUpInput for inprogress tasks", () => {
		render(<ExecutionPanel {...defaultProps} taskStatus="inprogress" />);

		expect(screen.getByTestId("follow-up-input")).toBeInTheDocument();
	});

	test('shows "Start Agent" button for todo tasks', () => {
		const onStartAgent = vi.fn();
		render(
			<ExecutionPanel
				{...defaultProps}
				taskStatus="todo"
				executionProcessId={null}
				onStartAgent={onStartAgent}
			/>,
		);

		expect(screen.getByText("Start Agent")).toBeInTheDocument();
	});

	test('shows "No execution data available" for done tasks without executionProcessId', () => {
		render(
			<ExecutionPanel
				{...defaultProps}
				taskStatus="done"
				executionProcessId={null}
			/>,
		);

		expect(screen.getByText("No execution data available")).toBeInTheDocument();
	});
});
