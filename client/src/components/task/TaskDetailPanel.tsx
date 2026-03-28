import { Maximize2, Play, Trash2, X } from "lucide-react";
import { useCallback } from "react";
import { useSnapshot } from "valtio";
import { ExecutionPanel } from "@/components/chat/ExecutionPanel";
import { useExecution } from "@/hooks/useExecution";
import { useInlineEdit } from "@/hooks/useInlineEdit";
import { useLatestExecution } from "@/hooks/useLatestExecution";
import { useTaskMutations } from "@/hooks/useTaskMutations";
import { STATUS_CONFIG } from "@/lib/constants";
import { getIconComponent } from "@/lib/icons";
import { cn } from "@/lib/utils";
import {
	executionStore,
	taskStore,
	toolStore,
	uiActions,
	uiStore,
} from "@/store";
import { trpc } from "@/trpc";

interface TaskDetailPanelProps {
	taskId: string;
	className?: string;
	onClose?: () => void;
	onOpenFullscreen?: () => void;
}

export function TaskDetailPanel({
	taskId,
	className,
	onClose,
	onOpenFullscreen,
}: TaskDetailPanelProps) {
	useSnapshot(uiStore);
	const tasks = useSnapshot(taskStore);
	const executionState = useSnapshot(executionStore);
	const { tools } = useSnapshot(toolStore);
	const executeTool = trpc.tool.execute.useMutation();
	const { stop, isStopping } = useExecution();
	const { deleteTask } = useTaskMutations();

	// Load latest execution state from server (restores state after page reload)
	useLatestExecution(taskId);

	const task = tasks.tasks.find((t) => t.id === taskId);
	const { updateTask } = useTaskMutations();

	const saveTitle = useCallback(
		(title: string) => updateTask({ taskId, title }),
		[updateTask, taskId],
	);
	const saveDescription = useCallback(
		(description: string) => updateTask({ taskId, description }),
		[updateTask, taskId],
	);

	const titleEdit = useInlineEdit({
		value: task?.title ?? "",
		onSave: saveTitle,
	});
	const descEdit = useInlineEdit({
		value: task?.description ?? "",
		onSave: saveDescription,
		multiline: true,
	});

	if (!task) {
		return (
			<div
				className={cn(
					"flex items-center justify-center h-full bg-secondary border-l border-border",
					className,
				)}
			>
				<div className="text-muted">Task not found</div>
			</div>
		);
	}

	const statusConfig = STATUS_CONFIG[task.status];
	const execution = executionState.activeExecutions[task.id];
	const isExecuting = execution?.status === "running";

	const handleClose = () => {
		onClose?.();
	};

	const handleDelete = () => {
		uiActions.openConfirmDialog(
			"Are you sure you want to delete this task? This action cannot be undone.",
			() => {
				deleteTask(task.id);
				uiActions.closeTaskDetail();
			},
		);
	};

	const handleFullscreen = () => {
		onOpenFullscreen?.();
	};

	const handleToolClick = async (toolId: string) => {
		try {
			await executeTool.mutateAsync({ toolId, taskId });
		} catch (error) {
			console.error("Failed to execute tool:", error);
		}
	};

	const handleStartAgent = () => {
		uiActions.openStartAgentDialog(task.id, task.projectId);
	};

	const handleStop = async () => {
		if (execution?.executionProcessId) {
			await stop(execution.executionProcessId);
		}
	};

	return (
		<div
			className={cn(
				"flex flex-col h-full bg-secondary border-l border-border",
				className,
			)}
		>
			{/* Header */}
			<div className="flex items-center justify-between p-4 border-b border-border">
				<h2 className="text-base font-semibold text-primary-foreground">
					Task Details
				</h2>
				<div className="flex items-center gap-2">
					{/* Tool buttons */}
					{tools.length > 0 && (
						<div className="flex items-center gap-1">
							{tools.map((tool) => {
								const IconComponent = getIconComponent(tool.icon);
								return (
									<button
										type="button"
										key={tool.id}
										className="flex items-center justify-center h-7 w-7 rounded bg-hover text-secondary-foreground hover:text-primary-foreground"
										onClick={() => handleToolClick(tool.id)}
										title={tool.name}
									>
										{IconComponent && <IconComponent className="h-3.5 w-3.5" />}
									</button>
								);
							})}
						</div>
					)}
					{/* Delete button */}
					<button
						type="button"
						onClick={handleDelete}
						title="Delete task"
						className="flex items-center justify-center h-8 w-8 rounded-md text-secondary-foreground hover:text-destructive hover:bg-red-50"
					>
						<Trash2 className="h-4 w-4" />
					</button>
					{/* Fullscreen button */}
					{onOpenFullscreen && (
						<button
							type="button"
							onClick={handleFullscreen}
							title="Open fullscreen"
							className="flex items-center justify-center h-8 w-8 rounded-md text-secondary-foreground hover:text-primary-foreground hover:bg-hover"
						>
							<Maximize2 className="h-4 w-4" />
						</button>
					)}
					{/* Close button */}
					{onClose && (
						<button
							type="button"
							onClick={handleClose}
							className="flex items-center justify-center h-8 w-8 rounded-md text-secondary-foreground hover:text-primary-foreground hover:bg-hover"
						>
							<X className="h-4 w-4" />
						</button>
					)}
				</div>
			</div>

			{/* Task Info */}
			<div className="p-4 border-b border-border">
				<div className="flex flex-col gap-4">
					<div className="flex flex-col gap-2">
						{titleEdit.isEditing ? (
							<input
								ref={titleEdit.ref as React.RefObject<HTMLInputElement>}
								value={titleEdit.draft}
								onChange={(e) => titleEdit.setDraft(e.target.value)}
								onBlur={titleEdit.save}
								onKeyDown={titleEdit.handleKeyDown}
								className="text-lg font-semibold text-primary-foreground bg-transparent border-b border-border outline-none"
							/>
						) : (
							// biome-ignore lint/a11y/noStaticElementInteractions: inline edit trigger
							<h3
								className="text-lg font-semibold text-primary-foreground cursor-text rounded px-1 -mx-1 hover:bg-hover"
								onClick={titleEdit.startEditing}
								onKeyDown={(e) => {
									if (e.key === "Enter") titleEdit.startEditing();
								}}
							>
								{task.title}
							</h3>
						)}
						{descEdit.isEditing ? (
							<textarea
								ref={descEdit.ref as React.RefObject<HTMLTextAreaElement>}
								value={descEdit.draft}
								onChange={(e) => descEdit.setDraft(e.target.value)}
								onBlur={descEdit.save}
								onKeyDown={descEdit.handleKeyDown}
								rows={3}
								className="text-sm text-secondary-foreground leading-[1.5] bg-transparent border border-border rounded outline-none resize-y p-1"
							/>
						) : (
							// biome-ignore lint/a11y/noStaticElementInteractions: inline edit trigger
							<p
								className="text-sm text-secondary-foreground leading-[1.5] cursor-text rounded px-1 -mx-1 hover:bg-hover min-h-[1.5em]"
								onClick={descEdit.startEditing}
								onKeyDown={(e) => {
									if (e.key === "Enter") descEdit.startEditing();
								}}
							>
								{task.description || "Add description..."}
							</p>
						)}
					</div>

					<div className="flex items-center gap-3">
						<span
							className={cn(
								"inline-flex items-center rounded px-3 py-1.5 text-xs font-semibold",
								statusConfig.bgColor,
								statusConfig.color,
							)}
						>
							{statusConfig.label}
						</span>
						{isExecuting && (
							<span className="inline-flex items-center gap-1.5 text-[13px] text-info">
								<Play className="h-3.5 w-3.5" />
								Running
							</span>
						)}
					</div>
				</div>
			</div>

			{/* Execution Panel */}
			<div className="flex-1 overflow-hidden">
				<ExecutionPanel
					taskId={task.id}
					taskTitle={task.title}
					sessionId={execution?.sessionId ?? null}
					executionProcessId={execution?.executionProcessId ?? null}
					taskStatus={task.status}
					className="h-full"
					onStartAgent={handleStartAgent}
					onStop={handleStop}
					isStopping={isStopping}
				/>
			</div>
		</div>
	);
}
