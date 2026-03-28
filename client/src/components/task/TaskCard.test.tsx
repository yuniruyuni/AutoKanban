import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import type { Task, Tool } from "@/store";
import { TaskCard } from "./TaskCard";

const mockTask: Task = {
	id: "task-1",
	projectId: "project-1",
	title: "Test Task",
	description: "Test description",
	status: "todo",
	createdAt: new Date().toISOString(),
	updatedAt: new Date().toISOString(),
};

const mockTools: Tool[] = [
	{
		id: "tool-1",
		name: "VS Code",
		icon: "Code",
		iconColor: "#007ACC",
		command: "code {path}",
		sortOrder: 0,
		createdAt: new Date().toISOString(),
		updatedAt: new Date().toISOString(),
	},
	{
		id: "tool-2",
		name: "Terminal",
		icon: "Terminal",
		iconColor: "#71717A",
		command: "open -a Terminal {path}",
		sortOrder: 1,
		createdAt: new Date().toISOString(),
		updatedAt: new Date().toISOString(),
	},
];

describe("TaskCard", () => {
	test("does not render tool buttons when tools is undefined", () => {
		render(<TaskCard task={mockTask} />);

		const buttons = screen.queryAllByRole("button");
		expect(buttons).toHaveLength(0);
	});

	test("does not render tool buttons when tools is empty", () => {
		render(<TaskCard task={mockTask} tools={[]} />);

		const buttons = screen.queryAllByRole("button");
		expect(buttons).toHaveLength(0);
	});

	test("renders tool buttons when tools are provided", () => {
		render(<TaskCard task={mockTask} tools={mockTools} />);

		expect(screen.getByTitle("VS Code")).toBeInTheDocument();
		expect(screen.getByTitle("Terminal")).toBeInTheDocument();
	});

	test("onToolClick is called with both toolId and taskId", () => {
		const onToolClick = vi.fn();

		render(
			<TaskCard task={mockTask} tools={mockTools} onToolClick={onToolClick} />,
		);

		const vsCodeButton = screen.getByTitle("VS Code");
		fireEvent.click(vsCodeButton);

		expect(onToolClick).toHaveBeenCalledTimes(1);
		expect(onToolClick).toHaveBeenCalledWith("tool-1", "task-1");
	});

	test("tool button click does not propagate to card onClick", () => {
		const onClick = vi.fn();
		const onToolClick = vi.fn();

		render(
			<TaskCard
				task={mockTask}
				tools={mockTools}
				onClick={onClick}
				onToolClick={onToolClick}
			/>,
		);

		const vsCodeButton = screen.getByTitle("VS Code");
		fireEvent.click(vsCodeButton);

		expect(onToolClick).toHaveBeenCalledTimes(1);
		expect(onClick).not.toHaveBeenCalled();
	});
});
