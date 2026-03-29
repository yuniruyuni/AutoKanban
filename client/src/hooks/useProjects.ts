import { useEffect } from "react";
import { mapProject, mapProjectWithStats } from "@/lib/mappers";
import { projectActions } from "@/store";
import { trpc } from "@/trpc";

export function useProjects() {
	const query = trpc.project.list.useQuery();

	useEffect(() => {
		if (query.data) {
			const projects = query.data.projects.map(mapProjectWithStats);
			projectActions.setProjects(projects);
		}
	}, [query.data]);

	return {
		projects: query.data?.projects.map(mapProjectWithStats) ?? [],
		isLoading: query.isLoading,
		error: query.error ?? null,
		refetch: query.refetch,
	};
}

export function useProject(projectId: string | null) {
	const query = trpc.project.get.useQuery(
		{ projectId: projectId ?? "" },
		{ enabled: !!projectId },
	);

	return {
		project: query.data ? mapProjectWithStats(query.data) : null,
		isLoading: query.isLoading,
		error: query.error ?? null,
	};
}

export interface CreateProjectInput {
	name: string;
	description?: string | null;
	repoPath: string;
	branch?: string;
}

export interface UpdateProjectInput {
	projectId: string;
	name?: string;
	description?: string | null;
}

export function useProjectMutations() {
	const utils = trpc.useUtils();

	const createProject = trpc.project.create.useMutation({
		onSuccess: () => {
			utils.project.list.invalidate();
		},
	});

	const deleteProject = trpc.project.delete.useMutation({
		onSuccess: () => {
			utils.project.list.invalidate();
		},
	});

	const updateProject = trpc.project.update.useMutation({
		onSuccess: () => {
			utils.project.list.invalidate();
			utils.project.get.invalidate();
		},
	});

	return {
		createProject: async (data: CreateProjectInput) => {
			const result = await createProject.mutateAsync(data);
			// The create endpoint returns Project, not ProjectWithStats
			// We need to add default stats
			return {
				...mapProject(result),
				taskStats: {
					todo: 0,
					inProgress: 0,
					inReview: 0,
					done: 0,
					cancelled: 0,
				},
			};
		},
		deleteProject: async (projectId: string, deleteWorktrees?: boolean) => {
			await deleteProject.mutateAsync({
				projectId,
				deleteWorktrees: deleteWorktrees ?? false,
			});
		},
		updateProject: async (data: UpdateProjectInput) => {
			const result = await updateProject.mutateAsync(data);
			return mapProject(result);
		},
		isCreating: createProject.isPending,
		isDeleting: deleteProject.isPending,
		isUpdating: updateProject.isPending,
	};
}
