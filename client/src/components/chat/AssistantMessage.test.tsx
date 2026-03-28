import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { AssistantMessage } from "./AssistantMessage";

describe("AssistantMessage", () => {
	test('renders "C" text avatar instead of Bot icon', () => {
		render(<AssistantMessage content={{ type: "text", text: "Hello" }} />);

		expect(screen.getByText("C")).toBeInTheDocument();
	});

	test("does not render Bot icon", () => {
		render(<AssistantMessage content={{ type: "text", text: "Hello" }} />);

		// Bot icon from lucide-react would have specific SVG structure
		const svgElements = document.querySelectorAll("svg");
		const botIcons = Array.from(svgElements).filter((svg) =>
			svg.classList.contains("lucide-bot"),
		);
		expect(botIcons.length).toBe(0);
	});

	test("avatar has accent background", () => {
		render(<AssistantMessage content={{ type: "text", text: "Hello" }} />);

		const avatar = screen.getByText("C").closest("div");
		expect(avatar).toHaveClass("bg-accent");
	});

	test("avatar has correct size (h-9 w-9)", () => {
		render(<AssistantMessage content={{ type: "text", text: "Hello" }} />);

		const avatar = screen.getByText("C").closest("div");
		expect(avatar).toHaveClass("h-9", "w-9");
	});

	test("avatar is circular (rounded-full)", () => {
		render(<AssistantMessage content={{ type: "text", text: "Hello" }} />);

		const avatar = screen.getByText("C").closest("div");
		expect(avatar).toHaveClass("rounded-full");
	});

	test("avatar text is white", () => {
		render(<AssistantMessage content={{ type: "text", text: "Hello" }} />);

		const avatarText = screen.getByText("C");
		expect(avatarText).toHaveClass("text-white");
	});

	test("avatar text is bold", () => {
		render(<AssistantMessage content={{ type: "text", text: "Hello" }} />);

		const avatarText = screen.getByText("C");
		expect(avatarText).toHaveClass("font-bold");
	});

	test("renders message content", () => {
		render(
			<AssistantMessage
				content={{ type: "text", text: "Hello, how can I help you?" }}
			/>,
		);

		expect(screen.getByText("Hello, how can I help you?")).toBeInTheDocument();
	});

	test("renders markdown content", () => {
		render(
			<AssistantMessage content={{ type: "text", text: "**Bold text**" }} />,
		);

		const boldElement = screen.getByText("Bold text");
		expect(boldElement.tagName).toBe("STRONG");
	});
});
