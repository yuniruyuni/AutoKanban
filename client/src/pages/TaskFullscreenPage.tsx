import { useEffect } from "react";
import { useSnapshot } from "valtio";
import { ConfirmDialog } from "@/components/atoms/ConfirmDialog";
import { ShortcutHelp } from "@/components/atoms/ShortcutHelp";
import { StartAgentDialog } from "@/components/chat/StartAgentDialog";
import { TaskDetailFullscreen } from "@/components/task/TaskDetailFullscreen";
import { useEscapeNavigation } from "@/hooks/useEscapeNavigation";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { useTaskNavigation } from "@/hooks/useTaskNavigation";
import { useTasks } from "@/hooks/useTasks";
import { projectActions, projectStore, uiActions } from "@/store";

export function TaskFullscreenPage() {
	const { projectId, taskId, exitFullscreen, closePanel, openTask, openFullscreen } =
		useTaskNavigation();
	useEscapeNavigation();
	const projectState = useSnapshot(projectStore);
	const { tasks } = useTasks({ projectId: projectId ?? "" });
	useKeyboardShortcuts({
		taskId,
		isFullscreen: true,
		isPanelOpen: false,
		openFullscreen,
		openTask,
		tasks,
	});

	// Sync URL projectId with store
	useEffect(() => {
		if (projectId && projectId !== projectState.selectedProjectId) {
			projectActions.selectProject(projectId);
		}
	}, [projectId, projectState.selectedProjectId]);

	// Sync URL taskId with store
	useEffect(() => {
		if (taskId) {
			uiActions.openTaskDetail(taskId);
		}
	}, [taskId]);

	if (!projectId || !taskId) {
		return null;
	}

	const handleBack = () => {
		exitFullscreen();
	};

	const handleMinimize = () => {
		// Go to side panel view
		exitFullscreen();
	};

	const handleClose = () => {
		// Go back to kanban
		uiActions.closeTaskDetail();
		closePanel();
	};

	return (
		<>
			<TaskDetailFullscreen
				taskId={taskId}
				onBack={handleBack}
				onMinimize={handleMinimize}
				onClose={handleClose}
			/>
			<ConfirmDialog />
			<StartAgentDialog />
			<ShortcutHelp />
		</>
	);
}
