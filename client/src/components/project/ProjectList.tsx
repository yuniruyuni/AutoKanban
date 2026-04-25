import { FolderOpen } from "lucide-react";
import { useSnapshot } from "valtio";
import { QueryState } from "@/components/atoms/QueryState";
import { useProjectMutations, useProjects } from "@/hooks/useProjects";
import { projectActions, uiActions, uiStore } from "@/store";
import { ProjectCard } from "./ProjectCard";

interface ProjectListProps {
	onProjectSelect: (projectId: string) => void;
}

export function ProjectList({ onProjectSelect }: ProjectListProps) {
	const { projects, isLoading, error, refetch } = useProjects();
	const { deleteProject } = useProjectMutations();
	const { focusedProjectId } = useSnapshot(uiStore);

	const handleDeleteProject = (projectId: string) => {
		uiActions.openTypedConfirmDialog({
			type: "delete-project",
			title: "Delete Project?",
			message:
				"This project and all associated data will be permanently removed.",
			action: () => {
				deleteProject(projectId, uiStore.confirmDialogCheckbox);
			},
		});
	};

	return (
		<QueryState isLoading={isLoading} error={error} onRetry={refetch}>
			{projects.length === 0 ? (
				<div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-border py-12">
					<FolderOpen className="mb-4 h-12 w-12 text-muted" />
					<h3 className="mb-1 text-lg font-medium text-primary-foreground">
						No projects yet
					</h3>
					<p className="mb-4 text-sm text-secondary-foreground">
						Create your first project to get started
					</p>
				</div>
			) : (
				<div className="flex flex-col gap-4">
					{projects.map((project) => (
						<ProjectCard
							key={project.id}
							project={project}
							isFocused={focusedProjectId === project.id}
							onSelect={() => {
								projectActions.selectProject(project.id);
								onProjectSelect(project.id);
							}}
							onDelete={() => handleDeleteProject(project.id)}
							onEdit={() => uiActions.openEditProject(project.id)}
						/>
					))}
				</div>
			)}
		</QueryState>
	);
}
