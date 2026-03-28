import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { AnsiText } from "./ansi";

describe("AnsiText", () => {
	test("renders plain text without ANSI codes", () => {
		render(<AnsiText text="Hello World" />);
		expect(screen.getByText("Hello World")).toBeInTheDocument();
	});

	test("renders text with red color code", () => {
		// \x1b[31m = red foreground
		render(<AnsiText text={"\x1b[31mRed Text\x1b[0m"} />);
		const redSpan = screen.getByText("Red Text");
		expect(redSpan).toHaveStyle({ color: "#cc0000" });
	});

	test("renders text with green color code", () => {
		// \x1b[32m = green foreground
		render(<AnsiText text={"\x1b[32mGreen Text\x1b[0m"} />);
		const greenSpan = screen.getByText("Green Text");
		expect(greenSpan).toHaveStyle({ color: "#00cc00" });
	});

	test("renders text with bold style", () => {
		// \x1b[1m = bold
		render(<AnsiText text={"\x1b[1mBold Text\x1b[0m"} />);
		const boldSpan = screen.getByText("Bold Text");
		expect(boldSpan).toHaveStyle({ fontWeight: "bold" });
	});

	test("renders multiple colors in sequence", () => {
		render(
			<AnsiText text={"\x1b[31mRed\x1b[0m Normal \x1b[32mGreen\x1b[0m"} />,
		);
		expect(screen.getByText("Red")).toHaveStyle({ color: "#cc0000" });
		expect(screen.getByText("Green")).toHaveStyle({ color: "#00cc00" });
	});

	test("handles reset code correctly", () => {
		// After reset, should use default color
		render(
			<AnsiText
				text={"\x1b[31mRed\x1b[0m After Reset"}
				defaultColor="#ffffff"
			/>,
		);
		const afterReset = screen.getByText("After Reset");
		expect(afterReset).toHaveStyle({ color: "#ffffff" });
	});

	test("handles bright colors", () => {
		// \x1b[91m = bright red
		render(<AnsiText text={"\x1b[91mBright Red\x1b[0m"} />);
		const brightRed = screen.getByText("Bright Red");
		expect(brightRed).toHaveStyle({ color: "#ff0000" });
	});

	test("handles dim style", () => {
		// \x1b[2m = dim
		render(<AnsiText text={"\x1b[2mDim Text\x1b[0m"} />);
		const dimSpan = screen.getByText("Dim Text");
		expect(dimSpan).toHaveStyle({ opacity: "0.5" });
	});

	test("preserves whitespace and newlines", () => {
		render(<AnsiText text={"Line 1\nLine 2"} />);
		expect(screen.getByText(/Line 1/)).toBeInTheDocument();
	});

	test("uses default color for unstyled text", () => {
		render(<AnsiText text="Plain" defaultColor="#aabbcc" />);
		const plainSpan = screen.getByText("Plain");
		expect(plainSpan).toHaveStyle({ color: "#aabbcc" });
	});
});
