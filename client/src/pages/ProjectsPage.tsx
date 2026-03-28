import { useNavigate } from "react-router-dom";
import { useSnapshot } from "valtio";
import { ConfirmDialog } from "@/components/atoms/ConfirmDialog";
import { ShortcutHelp } from "@/components/atoms/ShortcutHelp";
import { Dialog, DialogContent, DialogHeader } from "@/components/atoms/Dialog";
import { ProjectForm } from "@/components/project/ProjectForm";
import { ProjectList } from "@/components/project/ProjectList";
import { SidebarLayout } from "@/components/project/SidebarLayout";
import { useProjectKeyboardNav } from "@/hooks/useProjectKeyboardNav";
import { useProject, useProjectMutations, useProjects } from "@/hooks/useProjects";
import { useTaskNavigation } from "@/hooks/useTaskNavigation";
import { paths } from "@/lib/paths";
import { uiActions, uiStore } from "@/store";

export function ProjectsPage() {
	const { goToProject } = useTaskNavigation();
	const navigate = useNavigate();
	const uiState = useSnapshot(uiStore);
	const { projects } = useProjects();
	useProjectKeyboardNav({ projects, onSelect: goToProject });
	const { updateProject, isUpdating } = useProjectMutations();

	const isEditMode =
		uiState.isProjectFormOpen && uiState.projectFormMode === "edit";
	const { project: editingProject } = useProject(
		isEditMode ? uiState.editingProjectId : null,
	);

	const handleEditSubmit = async (data: {
		name: string;
		description?: string;
		devScript?: string;
	}) => {
		if (!uiState.editingProjectId) return;
		await updateProject({
			projectId: uiState.editingProjectId,
			name: data.name,
			description: data.description ?? null,
			devServerScript: data.devScript ?? null,
		});
		uiActions.closeProjectForm();
	};

	return (
		<>
			<SidebarLayout>
				<div className="flex flex-col h-full gap-8 py-8 px-10">
					{/* Header */}
					<div className="flex items-center justify-between w-full">
						<div className="flex flex-col gap-1">
							<h1 className="text-[28px] font-bold text-primary-foreground">
								Projects
							</h1>
							<p className="text-sm font-normal text-secondary-foreground">
								Manage your project boards
							</p>
						</div>
						<button
							type="button"
							onClick={() => navigate(paths.newProject())}
							className="flex items-center justify-center rounded-md bg-accent gap-2 px-4 py-2.5 text-sm font-medium text-white"
						>
							New Project
						</button>
					</div>

					<div className="flex-1 min-h-0 overflow-y-auto">
						<ProjectList onProjectSelect={goToProject} />
					</div>
				</div>
			</SidebarLayout>

			{/* Edit Project Dialog */}
			<Dialog
				open={isEditMode}
				onClose={() => uiActions.closeProjectForm()}
				width={520}
			>
				<DialogHeader onClose={() => uiActions.closeProjectForm()}>
					Edit Project
				</DialogHeader>
				<DialogContent>
					{editingProject && (
						<ProjectForm
							initialValues={{
								name: editingProject.name,
								description: editingProject.description,
								devScript: editingProject.devServerScript,
							}}
							onSubmit={handleEditSubmit}
							onCancel={() => uiActions.closeProjectForm()}
							isSubmitting={isUpdating}
						/>
					)}
				</DialogContent>
			</Dialog>

			<ConfirmDialog />
			<ShortcutHelp />
		</>
	);
}
