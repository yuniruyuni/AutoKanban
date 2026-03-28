import {
	closestCorners,
	DndContext,
	type DragEndEvent,
	type DragOverEvent,
	DragOverlay,
	type DragStartEvent,
	KeyboardSensor,
	PointerSensor,
	useSensor,
	useSensors,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { useState } from "react";
import { useSnapshot } from "valtio";
import { Dialog, DialogContent, DialogHeader } from "@/components/atoms/Dialog";
import { TaskCard } from "@/components/task/TaskCard";
import { TaskForm } from "@/components/task/TaskForm";
import { useTaskMutations } from "@/hooks/useTaskMutations";
import { useTasks } from "@/hooks/useTasks";
import { KANBAN_COLUMNS } from "@/lib/constants";
import {
	type Task,
	type TaskStatus,
	toolStore,
	uiActions,
	uiStore,
} from "@/store";
import { trpc } from "@/trpc";
import { KanbanColumn } from "./KanbanColumn";

interface KanbanBoardProps {
	projectId: string;
	activeTaskId?: string;
	onTaskClick?: (taskId: string) => void;
	onTaskDoubleClick?: (taskId?: string) => void;
}

export function KanbanBoard({
	projectId,
	activeTaskId,
	onTaskClick,
	onTaskDoubleClick,
}: KanbanBoardProps) {
	const { tasks, isLoading } = useTasks({ projectId });
	const { createTask, updateTask, isCreating, isUpdating } = useTaskMutations();
	const uiState = useSnapshot(uiStore);
	const { tools } = useSnapshot(toolStore);
	const executeTool = trpc.tool.execute.useMutation();

	const [activeTask, setActiveTask] = useState<Task | null>(null);

	const sensors = useSensors(
		useSensor(PointerSensor, {
			activationConstraint: {
				distance: 8,
			},
		}),
		useSensor(KeyboardSensor, {
			coordinateGetter: sortableKeyboardCoordinates,
		}),
	);

	const getTasksByStatus = (status: TaskStatus) => {
		return tasks.filter((task) => task.status === status);
	};

	const handleDragStart = (event: DragStartEvent) => {
		const { active } = event;
		const task = tasks.find((t) => t.id === active.id);
		if (task) {
			setActiveTask(task);
		}
	};

	const handleDragOver = (_event: DragOverEvent) => {
		// Visual feedback is handled by the column's isOver state
	};

	const handleDragEnd = async (event: DragEndEvent) => {
		const { active, over } = event;
		setActiveTask(null);

		if (!over) return;

		const taskId = active.id as string;
		const task = tasks.find((t) => t.id === taskId);
		if (!task) return;

		// Determine the target status
		let targetStatus: TaskStatus | null = null;

		if (over.data.current?.type === "column") {
			targetStatus = over.data.current.status as TaskStatus;
		} else if (over.data.current?.type === "task") {
			const overTask = tasks.find((t) => t.id === over.id);
			if (overTask) {
				targetStatus = overTask.status;
			}
		}

		// Update task status if it changed
		if (!targetStatus || task.status === targetStatus) return;

		const from = task.status;
		const to = targetStatus;
		const doUpdate = () => updateTask({ taskId, status: to });

		// inprogress → todo: stop agent + reset chat
		if (from === "inprogress" && to === "todo") {
			uiActions.openTypedConfirmDialog({
				type: "stop-and-reset",
				title: "Stop Agent & Reset",
				message:
					"This will stop the running agent and reset the chat history. Are you sure?",
				action: doUpdate,
			});
			// inprogress → inreview/done/cancelled: stop agent
		} else if (
			from === "inprogress" &&
			(to === "inreview" || to === "done" || to === "cancelled")
		) {
			uiActions.openTypedConfirmDialog({
				type: "stop",
				title: "Stop Agent",
				message: "This will stop the running agent. Are you sure?",
				action: doUpdate,
			});
			// inreview/done/cancelled → todo: reset chat
		} else if (
			(from === "inreview" || from === "done" || from === "cancelled") &&
			to === "todo"
		) {
			uiActions.openTypedConfirmDialog({
				type: "reset",
				title: "Reset Chat",
				message:
					"This will reset the chat history for this task. Are you sure?",
				action: doUpdate,
			});
			// todo → inprogress: open start agent dialog
		} else if (from === "todo" && to === "inprogress") {
			uiActions.openStartAgentDialog(taskId, projectId);
			// inreview → inprogress: resume agent
		} else if (from === "inreview" && to === "inprogress") {
			uiActions.openTypedConfirmDialog({
				type: "resume",
				title: "Resume Agent",
				message: "This will resume the agent for this task. Are you sure?",
				action: doUpdate,
			});
			// All other transitions: direct update
		} else {
			try {
				await doUpdate();
			} catch (error) {
				console.error("Failed to update task status:", error);
			}
		}
	};

	const handleCreateTask = async (data: {
		title: string;
		description?: string;
	}) => {
		await createTask({ projectId, ...data });
		uiActions.closeTaskForm();
	};

	const handleEditTask = async (data: {
		title: string;
		description?: string;
		status?: TaskStatus;
	}) => {
		if (!uiState.editingTaskId) return;
		await updateTask({ taskId: uiState.editingTaskId, ...data });
		uiActions.closeTaskForm();
	};

	const handleToolClick = async (toolId: string, taskId: string) => {
		try {
			await executeTool.mutateAsync({ toolId, taskId });
		} catch (error) {
			console.error("Failed to execute tool:", error);
		}
	};

	const handleTaskClick = (taskId: string) => {
		if (onTaskClick) {
			onTaskClick(taskId);
		} else {
			uiActions.openTaskDetail(taskId);
		}
	};

	const editingTask = uiState.editingTaskId
		? tasks.find((t) => t.id === uiState.editingTaskId)
		: null;

	if (isLoading) {
		return (
			<div className="flex h-64 items-center justify-center">
				<div className="text-secondary-foreground">Loading tasks...</div>
			</div>
		);
	}

	return (
		<>
			<DndContext
				sensors={sensors}
				collisionDetection={closestCorners}
				onDragStart={handleDragStart}
				onDragOver={handleDragOver}
				onDragEnd={handleDragEnd}
			>
				<div className="flex h-full gap-4 overflow-x-auto p-6">
					{KANBAN_COLUMNS.map((status) => (
						<KanbanColumn
							key={status}
							status={status}
							tasks={getTasksByStatus(status)}
							activeTaskId={activeTaskId}
							onTaskClick={handleTaskClick}
							onTaskDoubleClick={onTaskDoubleClick}
							onAddTask={() => uiActions.openCreateTask()}
							tools={tools}
							onToolClick={handleToolClick}
						/>
					))}
				</div>

				<DragOverlay>
					{activeTask && (
						<TaskCard task={activeTask} isDragging tools={tools} />
					)}
				</DragOverlay>
			</DndContext>

			<Dialog
				open={uiState.isTaskFormOpen}
				onClose={() => uiActions.closeTaskForm()}
			>
				<DialogHeader onClose={() => uiActions.closeTaskForm()}>
					{uiState.taskFormMode === "create" ? "Create Task" : "Edit Task"}
				</DialogHeader>
				<DialogContent>
					<TaskForm
						initialValues={
							editingTask
								? {
										title: editingTask.title,
										description: editingTask.description,
										status: editingTask.status,
									}
								: undefined
						}
						onSubmit={
							uiState.taskFormMode === "create"
								? handleCreateTask
								: handleEditTask
						}
						onCancel={() => uiActions.closeTaskForm()}
						isSubmitting={isCreating || isUpdating}
						showStatus={uiState.taskFormMode === "edit"}
					/>
				</DialogContent>
			</Dialog>
		</>
	);
}
