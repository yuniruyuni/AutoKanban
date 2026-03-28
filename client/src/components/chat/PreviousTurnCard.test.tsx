import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { PreviousTurnCard } from "./PreviousTurnCard";

describe("PreviousTurnCard", () => {
	test("renders turn number and summary", () => {
		render(
			<PreviousTurnCard turnNumber={3} summary="Fixed auth bug">
				<p>Details</p>
			</PreviousTurnCard>,
		);
		expect(screen.getByText("Turn 3")).toBeInTheDocument();
		expect(screen.getByText("Fixed auth bug")).toBeInTheDocument();
	});

	test("children are hidden by default", () => {
		render(
			<PreviousTurnCard turnNumber={1} summary="Summary">
				<p>Hidden content</p>
			</PreviousTurnCard>,
		);
		expect(screen.queryByText("Hidden content")).not.toBeInTheDocument();
	});

	test("children are visible when defaultExpanded is true", () => {
		render(
			<PreviousTurnCard turnNumber={1} summary="Summary" defaultExpanded>
				<p>Visible content</p>
			</PreviousTurnCard>,
		);
		expect(screen.getByText("Visible content")).toBeInTheDocument();
	});

	test("toggles children on click", () => {
		render(
			<PreviousTurnCard turnNumber={1} summary="Summary">
				<p>Toggle me</p>
			</PreviousTurnCard>,
		);

		expect(screen.queryByText("Toggle me")).not.toBeInTheDocument();

		fireEvent.click(screen.getByText("Turn 1"));
		expect(screen.getByText("Toggle me")).toBeInTheDocument();

		fireEvent.click(screen.getByText("Turn 1"));
		expect(screen.queryByText("Toggle me")).not.toBeInTheDocument();
	});

	test("applies custom className", () => {
		const { container } = render(
			<PreviousTurnCard turnNumber={1} summary="Summary" className="my-4">
				<p>Content</p>
			</PreviousTurnCard>,
		);
		expect(container.firstChild).toHaveClass("my-4");
	});
});
