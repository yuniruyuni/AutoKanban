import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { TaskCard } from "@/components/task/TaskCard";
import type { Task, Tool } from "@/store";

interface KanbanCardProps {
	task: Task;
	onClick?: () => void;
	isActive?: boolean;
	onDoubleClick?: () => void;
	tools?: readonly Tool[];
	onToolClick?: (toolId: string, taskId: string) => void;
}

export function KanbanCard({
	task,
	onClick,
	isActive,
	onDoubleClick,
	tools,
	onToolClick,
}: KanbanCardProps) {
	const {
		attributes,
		listeners,
		setNodeRef,
		transform,
		transition,
		isDragging,
	} = useSortable({
		id: task.id,
		data: {
			type: "task",
			task,
		},
	});

	const style = {
		transform: CSS.Transform.toString(transform),
		transition,
		opacity: isDragging ? 0.5 : 1,
	};

	return (
		// biome-ignore lint/a11y/noStaticElementInteractions: role and keyboard handlers provided by dnd-kit via attributes/listeners
		<div
			ref={setNodeRef}
			style={style}
			data-task-id={task.id}
			{...attributes}
			{...listeners}
			onDoubleClick={onDoubleClick}
		>
			<TaskCard
				task={task}
				onClick={onClick}
				isActive={isActive}
				isDragging={isDragging}
				tools={tools}
				onToolClick={onToolClick}
			/>
		</div>
	);
}
