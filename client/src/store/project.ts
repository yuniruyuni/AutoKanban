import { proxy } from "valtio";

export interface Project {
	id: string;
	name: string;
	description: string | null;
	repoPath: string;
	branch: string;
	setupScript: string | null;
	cleanupScript: string | null;
	devServerScript: string | null;
	createdAt: string;
	updatedAt: string;
}

export interface TaskStatistics {
	todo: number;
	inProgress: number;
	inReview: number;
	done: number;
	cancelled: number;
}

export interface ProjectWithStats extends Project {
	taskStats: TaskStatistics;
}

interface ProjectState {
	projects: ProjectWithStats[];
	selectedProjectId: string | null;
}

export const projectStore = proxy<ProjectState>({
	projects: [],
	selectedProjectId: null,
});

export const projectActions = {
	setProjects(projects: ProjectWithStats[]) {
		projectStore.projects = projects;
	},

	selectProject(projectId: string | null) {
		projectStore.selectedProjectId = projectId;
	},

	addProject(project: ProjectWithStats) {
		projectStore.projects.push(project);
	},

	getSelectedProject(): ProjectWithStats | null {
		return (
			projectStore.projects.find(
				(p) => p.id === projectStore.selectedProjectId,
			) ?? null
		);
	},
};
