import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import { Toggle } from "./Toggle";

describe("Toggle", () => {
	test('renders with role="switch"', () => {
		render(<Toggle checked={false} onChange={() => {}} />);
		expect(screen.getByRole("switch")).toBeInTheDocument();
	});

	test("has aria-checked=false when unchecked", () => {
		render(<Toggle checked={false} onChange={() => {}} />);
		expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "false");
	});

	test("has aria-checked=true when checked", () => {
		render(<Toggle checked={true} onChange={() => {}} />);
		expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "true");
	});

	test("calls onChange with toggled value on click", () => {
		const onChange = vi.fn();
		render(<Toggle checked={false} onChange={onChange} />);
		fireEvent.click(screen.getByRole("switch"));
		expect(onChange).toHaveBeenCalledWith(true);
	});

	test("calls onChange with false when checked and clicked", () => {
		const onChange = vi.fn();
		render(<Toggle checked={true} onChange={onChange} />);
		fireEvent.click(screen.getByRole("switch"));
		expect(onChange).toHaveBeenCalledWith(false);
	});

	test("does not call onChange when disabled", () => {
		const onChange = vi.fn();
		render(<Toggle checked={false} onChange={onChange} disabled />);
		fireEvent.click(screen.getByRole("switch"));
		expect(onChange).not.toHaveBeenCalled();
	});

	test("applies disabled styling", () => {
		render(<Toggle checked={false} onChange={() => {}} disabled />);
		expect(screen.getByRole("switch")).toBeDisabled();
	});
});
