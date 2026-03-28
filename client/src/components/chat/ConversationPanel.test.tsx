import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { ConversationPanel } from "./ConversationPanel";

// Mock trpc
vi.mock("@/trpc", () => ({
	trpc: {
		execution: {
			getConversationHistory: {
				useQuery: () => ({
					data: { ok: true, value: { turns: [] } },
				}),
			},
			getStructuredLogs: {
				useQuery: () => ({
					data: { entries: [] },
				}),
			},
			getPendingPermissions: {
				useQuery: () => ({
					data: { permissions: [] },
				}),
			},
		},
		approval: {
			getPending: {
				useQuery: () => ({
					data: { approvals: [] },
				}),
			},
		},
	},
}));

// Mock PlanResponseInput
vi.mock("@/components/chat/PlanResponseInput", () => ({
	PlanResponseInput: () => (
		<div data-testid="plan-response-input">Mock PlanResponseInput</div>
	),
}));

// Mock PermissionResponseInput
vi.mock("@/components/chat/PermissionResponseInput", () => ({
	PermissionResponseInput: () => (
		<div data-testid="permission-response-input">
			Mock PermissionResponseInput
		</div>
	),
}));

// Mock usePlanPendingState
vi.mock("@/hooks/usePlanPendingState", () => ({
	usePlanPendingState: () => ({
		isPlanPending: false,
		approvalId: null,
		executionProcessId: null,
	}),
}));

// Mock useTodoProgress
vi.mock("@/hooks/useTodoProgress", () => ({
	useTodoProgress: () => ({ todos: [], completed: 0, total: 0, percentage: 0 }),
}));

// Mock TodoProgressPopup
vi.mock("./TodoProgressPopup", () => ({
	TodoProgressPopup: () => (
		<div data-testid="todo-progress-popup">Mock TodoProgressPopup</div>
	),
}));

// Mock FollowUpInput
vi.mock("@/components/chat/FollowUpInput", () => ({
	FollowUpInput: ({
		sessionId,
		isRunning,
	}: {
		sessionId: string | null;
		isRunning: boolean;
	}) => (
		<div
			data-testid="follow-up-input"
			data-session-id={sessionId}
			data-is-running={isRunning}
		>
			Mock FollowUpInput
		</div>
	),
}));

// Mock ChatContainer
vi.mock("@/components/chat", () => ({
	ChatContainer: ({
		executionProcessId,
		isRunning,
	}: {
		executionProcessId: string;
		isRunning: boolean;
	}) => (
		<div
			data-testid="chat-container"
			data-execution-process-id={executionProcessId}
			data-is-running={isRunning}
		>
			Mock ChatContainer
		</div>
	),
}));

describe("ConversationPanel", () => {
	const defaultProps = {
		workspaceId: "workspace-1",
		executionProcessId: "exec-1",
		sessionId: "session-1",
		isRunning: false,
	};

	beforeEach(() => {
		vi.clearAllMocks();
	});

	test('displays "Claude Code" header text', () => {
		render(<ConversationPanel {...defaultProps} />);
		expect(screen.getByText("Claude Code")).toBeInTheDocument();
	});

	test('displays accent "C" icon', () => {
		render(<ConversationPanel {...defaultProps} />);
		const cIcon = screen.getByText("C");
		expect(cIcon).toBeInTheDocument();
		expect(cIcon.parentElement).toHaveClass("bg-accent");
	});

	test("shows running status when isRunning is true", () => {
		render(<ConversationPanel {...defaultProps} isRunning={true} />);
		expect(screen.getByText("Running")).toBeInTheDocument();
	});

	test("does not show running status when isRunning is false", () => {
		render(<ConversationPanel {...defaultProps} isRunning={false} />);
		expect(screen.queryByText("Running")).not.toBeInTheDocument();
	});

	test("shows Stop button when running and onStop is provided", () => {
		const onStop = vi.fn();
		render(
			<ConversationPanel {...defaultProps} isRunning={true} onStop={onStop} />,
		);
		expect(screen.getByText("Stop")).toBeInTheDocument();
	});

	test("does not show Stop button when not running", () => {
		const onStop = vi.fn();
		render(
			<ConversationPanel {...defaultProps} isRunning={false} onStop={onStop} />,
		);
		expect(screen.queryByText("Stop")).not.toBeInTheDocument();
	});

	test("calls onStop when Stop button is clicked", () => {
		const onStop = vi.fn();
		render(
			<ConversationPanel {...defaultProps} isRunning={true} onStop={onStop} />,
		);

		const stopButton = screen.getByText("Stop");
		fireEvent.click(stopButton);

		expect(onStop).toHaveBeenCalledTimes(1);
	});

	test('shows "Stopping..." when isStopping is true', () => {
		const onStop = vi.fn();
		render(
			<ConversationPanel
				{...defaultProps}
				isRunning={true}
				onStop={onStop}
				isStopping={true}
			/>,
		);
		expect(screen.getByText("Stopping...")).toBeInTheDocument();
	});

	test("Stop button is disabled when isStopping is true", () => {
		const onStop = vi.fn();
		render(
			<ConversationPanel
				{...defaultProps}
				isRunning={true}
				onStop={onStop}
				isStopping={true}
			/>,
		);

		const stopButton = screen.getByText("Stopping...").closest("button");
		expect(stopButton).toBeDisabled();
	});

	test("displays green running indicator dot when running", () => {
		render(<ConversationPanel {...defaultProps} isRunning={true} />);

		// Find the green dot (h-2 w-2 rounded-sm bg-success)
		const runningText = screen.getByText("Running");
		const runningContainer = runningText.parentElement;
		const greenDot = runningContainer?.querySelector(".bg-success");
		expect(greenDot).toBeInTheDocument();
	});
});
