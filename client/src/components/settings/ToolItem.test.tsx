import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import { ToolItem } from "./ToolItem";

describe("ToolItem", () => {
	const defaultProps = {
		name: "ESLint",
		command: "eslint --fix .",
		iconName: "code",
		iconColor: "#4B32C3",
		onEdit: vi.fn(),
		onDelete: vi.fn(),
	};

	test("renders tool name", () => {
		render(<ToolItem {...defaultProps} />);
		expect(screen.getByText("ESLint")).toBeInTheDocument();
	});

	test("renders command", () => {
		render(<ToolItem {...defaultProps} />);
		expect(screen.getByText("eslint --fix .")).toBeInTheDocument();
	});

	test("renders icon with background color", () => {
		const { container } = render(<ToolItem {...defaultProps} />);
		const iconContainer = container.querySelector("[style]");
		expect(iconContainer).toHaveStyle({ backgroundColor: "#4B32C3" });
	});

	test("calls onEdit when edit button clicked", () => {
		const onEdit = vi.fn();
		render(<ToolItem {...defaultProps} onEdit={onEdit} />);
		fireEvent.click(screen.getByLabelText("Edit ESLint"));
		expect(onEdit).toHaveBeenCalledOnce();
	});

	test("calls onDelete when delete button clicked", () => {
		const onDelete = vi.fn();
		render(<ToolItem {...defaultProps} onDelete={onDelete} />);
		fireEvent.click(screen.getByLabelText("Delete ESLint"));
		expect(onDelete).toHaveBeenCalledOnce();
	});
});
