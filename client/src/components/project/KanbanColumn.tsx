import { useDroppable } from "@dnd-kit/core";
import {
	SortableContext,
	verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { Plus } from "lucide-react";
import { STATUS_CONFIG } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { Task, TaskStatus, Tool } from "@/store";
import { KanbanCard } from "./KanbanCard";

interface KanbanColumnProps {
	status: TaskStatus;
	tasks: Task[];
	activeTaskId?: string | null;
	onTaskClick: (taskId: string) => void;
	onTaskDoubleClick?: (taskId?: string) => void;
	onAddTask?: () => void;
	tools?: readonly Tool[];
	onToolClick?: (toolId: string, taskId: string) => void;
}

export function KanbanColumn({
	status,
	tasks,
	activeTaskId,
	onTaskClick,
	onTaskDoubleClick,
	onAddTask,
	tools,
	onToolClick,
}: KanbanColumnProps) {
	const { setNodeRef, isOver } = useDroppable({
		id: status,
		data: {
			type: "column",
			status,
		},
	});

	const config = STATUS_CONFIG[status];
	const taskIds = tasks.map((t) => t.id);

	return (
		<div className="flex h-full w-[300px] flex-shrink-0 flex-col gap-3 rounded-lg bg-secondary p-3">
			{/* Column Header */}
			<div className="flex items-center justify-between px-1">
				<div className="flex items-center gap-2">
					<span className="text-sm font-semibold text-primary-foreground">
						{config.label}
					</span>
					<span className="rounded bg-hover px-2 py-0.5 text-xs font-medium text-secondary-foreground">
						{tasks.length}
					</span>
				</div>
				{onAddTask && (
					<button
						type="button"
						onClick={onAddTask}
						className="flex h-7 w-7 items-center justify-center rounded bg-hover text-secondary-foreground hover:text-primary-foreground"
					>
						<Plus className="h-4 w-4" />
					</button>
				)}
			</div>

			{/* Cards Area */}
			<div
				ref={setNodeRef}
				className={cn(
					"flex flex-1 flex-col gap-2 overflow-y-auto transition-colors",
					isOver && "rounded-lg bg-hover/50",
					status === "cancelled" && "opacity-60",
				)}
			>
				<SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
					{tasks.map((task) => (
						<KanbanCard
							key={task.id}
							task={task}
							isActive={task.id === activeTaskId}
							onClick={() => onTaskClick(task.id)}
							onDoubleClick={() => onTaskDoubleClick?.(task.id)}
							tools={tools}
							onToolClick={onToolClick}
						/>
					))}
				</SortableContext>
			</div>
		</div>
	);
}
