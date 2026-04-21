// @specre 01KPNTBSG7R884Y412A422AVPE
import { type MouseEvent, useCallback, useEffect } from "react";
import { useSnapshot } from "valtio";
import { ConfirmDialog } from "@/components/atoms/ConfirmDialog";
import { ShortcutHelp } from "@/components/atoms/ShortcutHelp";
import { StartAgentDialog } from "@/components/chat/StartAgentDialog";
import { KanbanBoard } from "@/components/project/KanbanBoard";
import { TopBarLayout } from "@/components/project/TopBarLayout";
import { TaskDetailPanel } from "@/components/task/TaskDetailPanel";
import { useEscapeNavigation } from "@/hooks/useEscapeNavigation";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { useResizablePanel } from "@/hooks/useResizablePanel";
import { useTaskNavigation } from "@/hooks/useTaskNavigation";
import { useTasks } from "@/hooks/useTasks";
import { projectActions, projectStore, uiActions } from "@/store";

export function KanbanPage() {
	const {
		projectId,
		taskId,
		isPanelOpen,
		goToProjects,
		openTask,
		openFullscreen,
		closePanel,
	} = useTaskNavigation();
	useEscapeNavigation();
	const projectState = useSnapshot(projectStore);
	const { tasks } = useTasks({ projectId: projectId ?? "" });
	useKeyboardShortcuts({
		taskId,
		isFullscreen: false,
		isPanelOpen,
		openFullscreen,
		openTask,
		tasks,
	});
	const {
		containerRef,
		value: leftPanelRatio,
		handleMouseDown,
	} = useResizablePanel({
		mode: "ratio",
		initial: 0.6,
		min: 0.2,
		max: 0.8,
	});

	// Sync URL projectId with store
	useEffect(() => {
		if (projectId && projectId !== projectState.selectedProjectId) {
			projectActions.selectProject(projectId);
		}
	}, [projectId, projectState.selectedProjectId]);

	// Sync URL taskId with store for TaskDetailPanel
	useEffect(() => {
		if (taskId) {
			uiActions.openTaskDetail(taskId);
		} else {
			uiActions.closeTaskDetail();
		}
	}, [taskId]);

	const handleBoardClick = useCallback(
		(e: MouseEvent) => {
			// Close side panel when clicking kanban board background (not a task card)
			const target = e.target as HTMLElement;
			if (target.closest("[data-task-card]")) return;
			closePanel();
		},
		[closePanel],
	);

	const selectedProject = projectState.projects.find((p) => p.id === projectId);
	const projectName = selectedProject?.name ?? "Kanban Board";
	const repoPath = selectedProject?.repoPath;
	const branch = selectedProject?.branch;

	if (!projectId) {
		return null;
	}

	return (
		<>
			<TopBarLayout
				title={projectName}
				onBack={goToProjects}
				repoPath={repoPath}
				projectId={projectId}
				branch={branch}
			>
				<div className="h-full flex" ref={containerRef}>
					{isPanelOpen && taskId ? (
						<>
							{/* biome-ignore lint/a11y/useKeyWithClickEvents: click-to-close background interaction */}
							{/* biome-ignore lint/a11y/noStaticElementInteractions: click-to-close background interaction */}
							<div
								className="min-w-0 h-full overflow-auto"
								style={{ width: `${leftPanelRatio * 100}%` }}
								onClick={handleBoardClick}
							>
								<KanbanBoard
									projectId={projectId}
									activeTaskId={taskId}
									onTaskClick={openTask}
									onTaskDoubleClick={openFullscreen}
								/>
							</div>
							{/* biome-ignore lint/a11y/noStaticElementInteractions: resize handle uses mouse drag, not click interaction */}
							<div
								className="w-1 bg-border hover:bg-accent cursor-col-resize flex-shrink-0 transition-colors"
								onMouseDown={handleMouseDown}
							/>
							<div
								className="min-w-0 h-full overflow-hidden"
								style={{ width: `${(1 - leftPanelRatio) * 100}%` }}
							>
								<TaskDetailPanel
									taskId={taskId}
									onClose={closePanel}
									onOpenFullscreen={() => openFullscreen(taskId)}
								/>
							</div>
						</>
					) : (
						<div className="flex-1 h-full overflow-auto">
							<KanbanBoard
								projectId={projectId}
								onTaskClick={openTask}
								onTaskDoubleClick={openFullscreen}
							/>
						</div>
					)}
				</div>
			</TopBarLayout>
			<ConfirmDialog />
			<StartAgentDialog />
			<ShortcutHelp />
		</>
	);
}
