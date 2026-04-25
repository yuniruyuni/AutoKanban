import type { ProjectWithStats, TaskStatistics, Tool } from "@/store";

// Map server response to client Project type
export function mapProject(data: {
	id: string;
	name: string;
	description: string | null;
	repoPath: string;
	branch: string;
	createdAt: string;
	updatedAt: string;
}) {
	return {
		id: data.id,
		name: data.name,
		description: data.description,
		repoPath: data.repoPath,
		branch: data.branch,
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
	argv: readonly string[] | null;
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
		argv: data.argv,
		sortOrder: data.sortOrder,
		createdAt: data.createdAt,
		updatedAt: data.updatedAt,
	};
}
