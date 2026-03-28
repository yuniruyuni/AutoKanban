import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { FollowUpInput } from "./FollowUpInput";

// Mock trpc
vi.mock("@/trpc", () => ({
	trpc: {
		execution: {
			saveDraft: {
				useMutation: () => ({ mutate: vi.fn() }),
			},
			getDraft: {
				useQuery: () => ({ data: null }),
			},
		},
	},
}));

const mockSend = vi.fn();
const mockQueue = vi.fn();
const mockCancelQueue = vi.fn();

// Store the mock so we can modify it
let mockHookReturn = {
	send: mockSend,
	queue: mockQueue,
	cancelQueue: mockCancelQueue,
	queuedMessage: null as { prompt: string } | null,
	hasQueuedMessage: false,
	isSending: false,
	isQueueing: false,
	isCancelling: false,
};

vi.mock("@/hooks/useFollowUp", () => ({
	useFollowUp: () => mockHookReturn,
}));

vi.mock("@/hooks/useVariants", () => ({
	useVariants: () => ({
		variants: [
			{ id: "v1", name: "DEFAULT", permissionMode: "bypassPermissions" },
			{ id: "v2", name: "PLAN", permissionMode: "plan" },
		],
		isLoading: false,
	}),
}));

describe("FollowUpInput", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockHookReturn = {
			send: mockSend,
			queue: mockQueue,
			cancelQueue: mockCancelQueue,
			queuedMessage: null,
			hasQueuedMessage: false,
			isSending: false,
			isQueueing: false,
			isCancelling: false,
		};
	});

	test('placeholder text includes "Type your next instruction"', () => {
		render(<FollowUpInput sessionId="session-1" />);

		expect(
			screen.getByPlaceholderText(/Type your next instruction/),
		).toBeInTheDocument();
	});

	test("send button has accent background", () => {
		render(<FollowUpInput sessionId="session-1" />);

		const sendButton = screen.getByRole("button");
		expect(sendButton).toHaveClass("bg-accent");
	});

	test("send button is rounded", () => {
		render(<FollowUpInput sessionId="session-1" />);

		const sendButton = screen.getByRole("button");
		expect(sendButton).toHaveClass("rounded-md");
	});

	test("send button has correct size (h-8 w-8 = 32x32)", () => {
		render(<FollowUpInput sessionId="session-1" />);

		const sendButton = screen.getByRole("button");
		expect(sendButton).toHaveClass("h-8", "w-8");
	});

	describe("with queued message", () => {
		beforeEach(() => {
			mockHookReturn = {
				...mockHookReturn,
				queuedMessage: { prompt: "Test queued message" },
				hasQueuedMessage: true,
			};
		});

		test("queued message label has accent color", () => {
			render(<FollowUpInput sessionId="session-1" />);

			const queuedLabel = screen.getByText("Queued:");
			expect(queuedLabel).toHaveClass("text-accent");
		});

		test("queued message label is bold", () => {
			render(<FollowUpInput sessionId="session-1" />);

			const queuedLabel = screen.getByText("Queued:");
			expect(queuedLabel).toHaveClass("font-semibold");
		});

		test("queued message container has card background", () => {
			render(<FollowUpInput sessionId="session-1" />);

			const queuedLabel = screen.getByText("Queued:");
			const container = queuedLabel.closest("div");
			expect(container).toHaveClass("bg-card");
		});

		test("queued message displays the message text", () => {
			render(<FollowUpInput sessionId="session-1" />);

			expect(screen.getByText("Test queued message")).toBeInTheDocument();
		});

		test("uses Timer icon for queued message (not Clock)", () => {
			render(<FollowUpInput sessionId="session-1" />);

			// Timer icon should have the accent color
			const container = screen.getByText("Queued:").closest("div");
			const svgIcon = container?.querySelector("svg");
			expect(svgIcon).toBeInTheDocument();
			expect(svgIcon).toHaveClass("text-accent");
		});
	});

	test("renders textarea for multi-line input", () => {
		render(<FollowUpInput sessionId="session-1" />);

		const textarea = screen.getByRole("textbox");
		expect(textarea).toBeInTheDocument();
		expect(textarea.tagName).toBe("TEXTAREA");
	});

	test("textarea and footer (variant selector + button) are in chatBoxContainer", () => {
		render(<FollowUpInput sessionId="session-1" />);

		const textarea = screen.getByRole("textbox");
		const variantSelect = screen.getByRole("combobox");
		const button = screen.getByRole("button");

		// All should be inside the same chatBoxContainer (rounded-md border)
		const chatBox =
			textarea.closest(".rounded-md.border") ?? textarea.closest(".rounded-md");
		expect(chatBox).toContainElement(variantSelect);
		expect(chatBox).toContainElement(button);
	});

	test("shows keyboard shortcut hint", () => {
		render(<FollowUpInput sessionId="session-1" />);

		expect(screen.getByText("⌘+Enter")).toBeInTheDocument();
	});

	describe("variant selector", () => {
		test("renders variant selector dropdown", () => {
			render(<FollowUpInput sessionId="session-1" />);

			const variantSelect = screen.getByRole("combobox");
			expect(variantSelect).toBeInTheDocument();
		});

		test("variant selector has options from useVariants", () => {
			render(<FollowUpInput sessionId="session-1" />);

			const variantSelect = screen.getByRole("combobox");
			expect(variantSelect).toBeInTheDocument();

			const options = screen.getAllByRole("option");
			expect(options).toHaveLength(2);
			expect(options[0]).toHaveTextContent("DEFAULT");
			expect(options[1]).toHaveTextContent("PLAN");
		});

		test("variant selector defaults to first variant", () => {
			render(<FollowUpInput sessionId="session-1" />);

			const variantSelect = screen.getByRole("combobox") as HTMLSelectElement;
			expect(variantSelect.value).toBe("DEFAULT");
		});
	});
});
