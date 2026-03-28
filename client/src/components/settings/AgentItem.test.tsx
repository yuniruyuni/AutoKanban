import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import { AgentItem } from "./AgentItem";

const defaultProps = {
	name: "Code Review",
	letter: "CR",
	bgColor: "#E87B35",
	statusText: "4 variants configured",
	onConfigure: () => {},
};

describe("AgentItem", () => {
	test("renders agent name", () => {
		render(<AgentItem {...defaultProps} />);
		expect(screen.getByText("Code Review")).toBeInTheDocument();
	});

	test("renders Configure button", () => {
		render(<AgentItem {...defaultProps} name="Agent" />);
		expect(screen.getByText("Configure")).toBeInTheDocument();
	});

	test("calls onConfigure when Configure button clicked", () => {
		const onConfigure = vi.fn();
		render(
			<AgentItem {...defaultProps} name="Agent" onConfigure={onConfigure} />,
		);
		fireEvent.click(screen.getByText("Configure"));
		expect(onConfigure).toHaveBeenCalledOnce();
	});

	test("renders agent letter in icon", () => {
		render(<AgentItem {...defaultProps} />);
		expect(screen.getByText("CR")).toBeInTheDocument();
	});

	test("applies custom className", () => {
		const { container } = render(
			<AgentItem {...defaultProps} name="Agent" className="p-4" />,
		);
		expect(container.firstChild).toHaveClass("p-4");
	});
});
