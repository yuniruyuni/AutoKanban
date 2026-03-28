import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { SectionHeader } from "./SectionHeader";

describe("SectionHeader", () => {
	test("renders title", () => {
		render(<SectionHeader title="Settings" />);
		expect(screen.getByText("Settings")).toBeInTheDocument();
	});

	test("renders subtitle when provided", () => {
		render(<SectionHeader title="Tools" subtitle="Manage external tools" />);
		expect(screen.getByText("Manage external tools")).toBeInTheDocument();
	});

	test("does not render subtitle when not provided", () => {
		render(<SectionHeader title="Tools" />);
		const heading = screen.getByText("Tools");
		expect(heading.parentElement?.children).toHaveLength(1);
	});

	test("renders action when provided", () => {
		render(
			<SectionHeader
				title="Tools"
				action={<button type="button">Add</button>}
			/>,
		);
		expect(screen.getByText("Add")).toBeInTheDocument();
	});

	test("does not render action container when not provided", () => {
		const { container } = render(<SectionHeader title="Tools" />);
		expect(container.firstChild?.childNodes).toHaveLength(1);
	});
});
