import type { ProjectWithStats, TaskStatistics, Tool } from "@/store";

// Map server response to client Project type
export function mapProject(data: {
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
}) {
	return {
		id: data.id,
		name: data.name,
		description: data.description,
		repoPath: data.repoPath,
		branch: data.branch,
		setupScript: data.setupScript,
		cleanupScript: data.cleanupScript,
		devServerScript: data.devServerScript,
		createdAt: data.createdAt,
		updatedAt: data.updatedAt,
	};
}

export function mapProjectWithStats(data: {
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
	taskStats: TaskStatistics;
}): ProjectWithStats {
	return {
		...mapProject(data),
		taskStats: data.taskStats,
	};
}

// Map server response to client Tool type
export function mapTool(data: {
	id: string;
	name: string;
	icon: string;
	iconColor: string;
	command: string;
	sortOrder: number;
	createdAt: string;
	updatedAt: string;
}): Tool {
	return {
		id: data.id,
		name: data.name,
		icon: data.icon,
		iconColor: data.iconColor,
		command: data.command,
		sortOrder: data.sortOrder,
		createdAt: data.createdAt,
		updatedAt: data.updatedAt,
	};
}
