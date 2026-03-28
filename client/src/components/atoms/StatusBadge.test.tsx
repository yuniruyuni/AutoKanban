import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { StatusBadge } from "./StatusBadge";

describe("StatusBadge", () => {
	test("renders default label from STATUS_CONFIG", () => {
		render(<StatusBadge status="todo" />);
		expect(screen.getByText("Todo")).toBeInTheDocument();
	});

	test("renders custom label when provided", () => {
		render(<StatusBadge status="todo" label="Custom" />);
		expect(screen.getByText("Custom")).toBeInTheDocument();
		expect(screen.queryByText("Todo")).not.toBeInTheDocument();
	});

	test("applies status-specific color classes", () => {
		render(<StatusBadge status="inprogress" />);
		const badge = screen.getByText("In Progress");
		expect(badge).toHaveClass("text-white");
		expect(badge).toHaveClass("bg-info");
	});

	test("applies custom className", () => {
		render(<StatusBadge status="done" className="ml-2" />);
		expect(screen.getByText("Done")).toHaveClass("ml-2");
	});

	test("renders all status types", () => {
		const statuses = [
			"todo",
			"inprogress",
			"inreview",
			"done",
			"cancelled",
		] as const;
		const labels = ["Todo", "In Progress", "In Review", "Done", "Cancelled"];

		statuses.forEach((status, i) => {
			const { unmount } = render(<StatusBadge status={status} />);
			expect(screen.getByText(labels[i])).toBeInTheDocument();
			unmount();
		});
	});
});
