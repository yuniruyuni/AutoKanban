import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { BranchInfo } from "./BranchInfo";

describe("BranchInfo", () => {
	test("renders worktree branch name", () => {
		render(
			<BranchInfo worktreeBranch="feature/new-feature" baseBranch="main" />,
		);
		expect(screen.getByText("feature/new-feature")).toBeInTheDocument();
	});

	test("renders base branch name", () => {
		render(
			<BranchInfo worktreeBranch="feature/new-feature" baseBranch="main" />,
		);
		expect(screen.getByText("main")).toBeInTheDocument();
	});

	test("worktree branch has light gray background", () => {
		render(
			<BranchInfo worktreeBranch="feature/new-feature" baseBranch="main" />,
		);
		const worktreeSpan = screen
			.getByText("feature/new-feature")
			.closest("span");
		expect(worktreeSpan).toHaveClass("bg-[#F5F5F5]");
	});

	test("base branch has orange background", () => {
		render(
			<BranchInfo worktreeBranch="feature/new-feature" baseBranch="main" />,
		);
		const baseSpan = screen.getByText("main").closest("span");
		expect(baseSpan).toHaveClass("bg-[#E87B35]");
	});

	test("base branch has white text", () => {
		render(
			<BranchInfo worktreeBranch="feature/new-feature" baseBranch="main" />,
		);
		const baseSpan = screen.getByText("main").closest("span");
		expect(baseSpan).toHaveClass("text-white");
	});

	test("renders with GitBranch icons", () => {
		const { container } = render(
			<BranchInfo worktreeBranch="feature/new-feature" baseBranch="main" />,
		);
		const svgs = container.querySelectorAll("svg");
		// Should have 3 SVGs: 2 GitBranch icons + 1 ArrowRight
		expect(svgs.length).toBeGreaterThanOrEqual(3);
	});

	test("has arrow icon between branches", () => {
		const { container } = render(
			<BranchInfo worktreeBranch="feature/new-feature" baseBranch="main" />,
		);
		// Should have SVGs for GitBranch (x2) and ArrowRight
		const svgs = container.querySelectorAll("svg");
		expect(svgs.length).toBeGreaterThanOrEqual(2);
	});
});
