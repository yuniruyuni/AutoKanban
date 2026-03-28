import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { PageHeader } from "./PageHeader";

describe("PageHeader", () => {
	test("renders title", () => {
		render(<PageHeader title="Projects" />);
		expect(screen.getByText("Projects")).toBeInTheDocument();
	});

	test("renders title with correct font size", () => {
		render(<PageHeader title="Projects" />);
		expect(screen.getByText("Projects")).toHaveClass(
			"text-[28px]",
			"font-bold",
		);
	});

	test("renders subtitle when provided", () => {
		render(<PageHeader title="Projects" subtitle="All your projects" />);
		expect(screen.getByText("All your projects")).toBeInTheDocument();
	});

	test("does not render subtitle when not provided", () => {
		const { container } = render(<PageHeader title="Projects" />);
		const subtitles = container.querySelectorAll("p");
		expect(subtitles).toHaveLength(0);
	});

	test("applies custom className", () => {
		const { container } = render(
			<PageHeader title="Projects" className="mb-6" />,
		);
		expect(container.firstChild).toHaveClass("mb-6");
	});
});
