import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import { QueuedMessage } from "./QueuedMessage";

describe("QueuedMessage", () => {
	test('renders "Queued:" label', () => {
		render(<QueuedMessage message="Fix the bug" onClear={() => {}} />);
		expect(screen.getByText("Queued:")).toBeInTheDocument();
	});

	test("renders message text", () => {
		render(<QueuedMessage message="Fix the bug" onClear={() => {}} />);
		expect(screen.getByText("Fix the bug")).toBeInTheDocument();
	});

	test("renders clear button with aria-label", () => {
		render(<QueuedMessage message="msg" onClear={() => {}} />);
		expect(screen.getByLabelText("Clear queued message")).toBeInTheDocument();
	});

	test("calls onClear when clear button clicked", () => {
		const onClear = vi.fn();
		render(<QueuedMessage message="msg" onClear={onClear} />);
		fireEvent.click(screen.getByLabelText("Clear queued message"));
		expect(onClear).toHaveBeenCalledOnce();
	});

	test("applies custom className", () => {
		const { container } = render(
			<QueuedMessage message="msg" onClear={() => {}} className="mt-2" />,
		);
		expect(container.firstChild).toHaveClass("mt-2");
	});
});
