import { beforeEach, describe, expect, test } from "vitest";
import { type ProjectWithStats, projectActions, projectStore } from "./project";

const makeProject = (
	overrides: Partial<ProjectWithStats> = {},
): ProjectWithStats => ({
	id: "proj-1",
	name: "Test Project",
	description: null,
	repoPath: "/path/to/repo",
	branch: "main",
	setupScript: null,
	cleanupScript: null,
	devServerScript: null,
	createdAt: "2024-01-01T00:00:00Z",
	updatedAt: "2024-01-01T00:00:00Z",
	taskStats: { todo: 0, inProgress: 0, inReview: 0, done: 0, cancelled: 0 },
	...overrides,
});

describe("projectStore", () => {
	beforeEach(() => {
		projectStore.projects = [];
		projectStore.selectedProjectId = null;
	});

	describe("setProjects", () => {
		test("replaces projects array", () => {
			const projects = [makeProject({ id: "a" }), makeProject({ id: "b" })];
			projectActions.setProjects(projects);
			expect(projectStore.projects).toHaveLength(2);
			expect(projectStore.projects[0].id).toBe("a");
		});
	});

	describe("selectProject", () => {
		test("sets selected project ID", () => {
			projectActions.selectProject("proj-1");
			expect(projectStore.selectedProjectId).toBe("proj-1");
		});

		test("clears selection with null", () => {
			projectActions.selectProject("proj-1");
			projectActions.selectProject(null);
			expect(projectStore.selectedProjectId).toBeNull();
		});
	});

	describe("addProject", () => {
		test("appends project to end", () => {
			projectActions.addProject(makeProject({ id: "a" }));
			projectActions.addProject(makeProject({ id: "b" }));
			expect(projectStore.projects).toHaveLength(2);
			expect(projectStore.projects[1].id).toBe("b");
		});
	});

	describe("getSelectedProject", () => {
		test("returns matching project", () => {
			projectActions.setProjects([
				makeProject({ id: "proj-1", name: "Found" }),
			]);
			projectActions.selectProject("proj-1");
			const result = projectActions.getSelectedProject();
			expect(result).not.toBeNull();
			expect(result?.name).toBe("Found");
		});

		test("returns null when nothing selected", () => {
			projectActions.setProjects([makeProject({ id: "proj-1" })]);
			expect(projectActions.getSelectedProject()).toBeNull();
		});

		test("returns null for non-existent selected ID", () => {
			projectActions.setProjects([makeProject({ id: "proj-1" })]);
			projectActions.selectProject("nonexistent");
			expect(projectActions.getSelectedProject()).toBeNull();
		});
	});
});
