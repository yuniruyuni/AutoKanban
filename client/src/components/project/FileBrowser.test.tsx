import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { FileBrowser } from "./FileBrowser";

// Mock useDirectoryBrowser hook
const mockLeftBrowser = {
	currentPath: "/Users/test",
	parentPath: "/Users",
	entries: [
		{
			name: "project",
			path: "/Users/test/project",
			isDirectory: true,
			isGitRepo: true,
		},
		{
			name: "folder",
			path: "/Users/test/folder",
			isDirectory: true,
			isGitRepo: false,
		},
	],
	isLoading: false,
	error: null,
	navigateTo: vi.fn(),
	navigateUp: vi.fn(),
	navigateToHome: vi.fn(),
	canNavigateUp: true,
};

const mockRightBrowser = {
	currentPath: "/Users/test/project",
	parentPath: "/Users/test",
	entries: [
		{
			name: "src",
			path: "/Users/test/project/src",
			isDirectory: true,
			isGitRepo: false,
		},
		{
			name: "package.json",
			path: "/Users/test/project/package.json",
			isDirectory: false,
			isGitRepo: false,
			size: 1024,
		},
		{
			name: "index.ts",
			path: "/Users/test/project/index.ts",
			isDirectory: false,
			isGitRepo: false,
			size: 256,
		},
	],
	isLoading: false,
	error: null,
	navigateTo: vi.fn(),
	navigateUp: vi.fn(),
	navigateToHome: vi.fn(),
	canNavigateUp: true,
};

vi.mock("@/hooks/useDirectoryBrowser", () => ({
	useDirectoryBrowser: (initialPath?: string, includeFiles?: boolean) => {
		if (!includeFiles) {
			// Left pane - directories only
			return mockLeftBrowser;
		}
		// Right pane - with files
		if (!initialPath) {
			return {
				...mockRightBrowser,
				entries: [],
				isLoading: false,
			};
		}
		return mockRightBrowser;
	},
}));

describe("FileBrowser", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	test("renders left and right panes", () => {
		render(<FileBrowser onSelect={vi.fn()} selectedPath={null} />);

		// Left pane header
		expect(
			screen.getByText("Select Repository or Directory"),
		).toBeInTheDocument();
		// Right pane header (no selection)
		expect(
			screen.getByText("Select a directory to preview"),
		).toBeInTheDocument();
	});

	test("displays directories in left pane", () => {
		render(<FileBrowser onSelect={vi.fn()} selectedPath={null} />);

		// Should show both directories
		expect(screen.getByText("project")).toBeInTheDocument();
		expect(screen.getByText("folder")).toBeInTheDocument();
	});

	test("shows git badge for git repositories", () => {
		render(<FileBrowser onSelect={vi.fn()} selectedPath={null} />);

		// Should show git badge for the git repo
		const gitBadges = screen.getAllByText("git");
		expect(gitBadges.length).toBeGreaterThan(0);
	});

	test("shows go up button when can navigate up", () => {
		render(<FileBrowser onSelect={vi.fn()} selectedPath={null} />);

		expect(screen.getByText("..")).toBeInTheDocument();
	});

	test("calls onSelect when directory is clicked", () => {
		const onSelect = vi.fn();
		render(<FileBrowser onSelect={onSelect} selectedPath={null} />);

		fireEvent.click(screen.getByText("project"));

		expect(onSelect).toHaveBeenCalledWith(
			expect.objectContaining({
				name: "project",
				isDirectory: true,
				isGitRepo: true,
			}),
		);
	});

	test("highlights selected directory", () => {
		render(
			<FileBrowser onSelect={vi.fn()} selectedPath="/Users/test/project" />,
		);

		// The selected item should have accent background
		const projectItem = screen.getByText("project").closest("div");
		expect(projectItem).toHaveClass("bg-accent");
	});

	test("resize divider has col-resize cursor", () => {
		render(<FileBrowser onSelect={vi.fn()} selectedPath={null} />);

		const divider = screen.getByTestId("resize-divider");
		expect(divider).toHaveClass("cursor-col-resize");
	});

	test("displays breadcrumb path", () => {
		render(<FileBrowser onSelect={vi.fn()} selectedPath={null} />);

		// Path parts should be clickable
		expect(screen.getByText("Users")).toBeInTheDocument();
		expect(screen.getByText("test")).toBeInTheDocument();
	});

	test("shows placeholder text when no directory selected for right pane", () => {
		render(<FileBrowser onSelect={vi.fn()} selectedPath={null} />);

		expect(
			screen.getByText(
				"Select a directory from the left pane to preview its contents",
			),
		).toBeInTheDocument();
	});
});
