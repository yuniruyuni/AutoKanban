import { describe, expect, test } from "vitest";
import { mapProject, mapProjectWithStats, mapTool } from "./mappers";

describe("mapProject", () => {
	const baseProject = {
		id: "proj-1",
		name: "Test Project",
		description: "A test project",
		repoPath: "/path/to/repo",
		branch: "main",
		setupScript: "bun install",
		cleanupScript: "bun clean",
		devServerScript: "bun dev",
		createdAt: "2024-01-01T00:00:00Z",
		updatedAt: "2024-01-02T00:00:00Z",
	};

	test("maps all fields correctly", () => {
		const result = mapProject(baseProject);
		expect(result).toEqual(baseProject);
	});

	test("preserves null description", () => {
		const result = mapProject({ ...baseProject, description: null });
		expect(result.description).toBeNull();
	});

	test("preserves null scripts", () => {
		const result = mapProject({
			...baseProject,
			setupScript: null,
			cleanupScript: null,
			devServerScript: null,
		});
		expect(result.setupScript).toBeNull();
		expect(result.cleanupScript).toBeNull();
		expect(result.devServerScript).toBeNull();
	});
});

describe("mapProjectWithStats", () => {
	const baseData = {
		id: "proj-1",
		name: "Test Project",
		description: null,
		repoPath: "/path/to/repo",
		branch: "main",
		setupScript: null,
		cleanupScript: null,
		devServerScript: null,
		createdAt: "2024-01-01T00:00:00Z",
		updatedAt: "2024-01-02T00:00:00Z",
		taskStats: {
			todo: 3,
			inProgress: 1,
			inReview: 2,
			done: 5,
			cancelled: 0,
		},
	};

	test("includes all project fields and taskStats", () => {
		const result = mapProjectWithStats(baseData);
		expect(result.id).toBe("proj-1");
		expect(result.name).toBe("Test Project");
		expect(result.taskStats).toEqual(baseData.taskStats);
	});

	test("taskStats contains all status counts", () => {
		const result = mapProjectWithStats(baseData);
		expect(result.taskStats.todo).toBe(3);
		expect(result.taskStats.inProgress).toBe(1);
		expect(result.taskStats.inReview).toBe(2);
		expect(result.taskStats.done).toBe(5);
		expect(result.taskStats.cancelled).toBe(0);
	});
});

describe("mapTool", () => {
	const baseTool = {
		id: "tool-1",
		name: "Build",
		icon: "wrench",
		iconColor: "#ff0000",
		command: "bun run build",
		sortOrder: 1,
		createdAt: "2024-01-01T00:00:00Z",
		updatedAt: "2024-01-02T00:00:00Z",
	};

	test("maps all fields including sortOrder", () => {
		const result = mapTool(baseTool);
		expect(result).toEqual(baseTool);
	});

	test("preserves sortOrder value", () => {
		const result = mapTool({ ...baseTool, sortOrder: 99 });
		expect(result.sortOrder).toBe(99);
	});
});
