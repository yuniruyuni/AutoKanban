import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { FormField } from "./FormField";

describe("FormField", () => {
	test("renders label", () => {
		render(
			<FormField label="Username">
				<input />
			</FormField>,
		);
		expect(screen.getByText("Username")).toBeInTheDocument();
	});

	test("renders description when provided", () => {
		render(
			<FormField label="Name" description="Enter your full name">
				<input />
			</FormField>,
		);
		expect(screen.getByText("Enter your full name")).toBeInTheDocument();
	});

	test("does not render description when not provided", () => {
		render(
			<FormField label="Name">
				<input />
			</FormField>,
		);
		expect(screen.queryByText("Enter")).not.toBeInTheDocument();
	});

	test("renders children", () => {
		render(
			<FormField label="Field">
				<input data-testid="child-input" />
			</FormField>,
		);
		expect(screen.getByTestId("child-input")).toBeInTheDocument();
	});

	test("applies custom className", () => {
		const { container } = render(
			<FormField label="Field" className="mt-4">
				<input />
			</FormField>,
		);
		expect(container.firstChild).toHaveClass("mt-4");
	});
});
