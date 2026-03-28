import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { ServerStatus } from "./ServerStatus";

describe("ServerStatus", () => {
	test("renders server name", () => {
		render(<ServerStatus name="MCP Server" detail="Port 3001" connected />);
		expect(screen.getByText("MCP Server")).toBeInTheDocument();
	});

	test("renders detail text", () => {
		render(<ServerStatus name="Server" detail="Port 3001" connected />);
		expect(screen.getByText("Port 3001")).toBeInTheDocument();
	});

	test("shows green dot when connected", () => {
		render(<ServerStatus name="Server" detail="Port 3001" connected />);
		expect(screen.getByTitle("Connected")).toHaveClass("bg-success");
	});

	test("shows red dot when disconnected", () => {
		render(<ServerStatus name="Server" detail="Port 3001" connected={false} />);
		expect(screen.getByTitle("Disconnected")).toHaveClass("bg-muted");
	});

	test("applies custom className", () => {
		const { container } = render(
			<ServerStatus
				name="Server"
				detail="Port 3001"
				connected
				className="py-2"
			/>,
		);
		expect(container.firstChild).toHaveClass("py-2");
	});
});
