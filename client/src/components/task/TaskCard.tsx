import { STATUS_CONFIG } from "@/lib/constants";
import { getIconComponent } from "@/lib/icons";
import { cn } from "@/lib/utils";
import type { Task, Tool } from "@/store";

interface TaskCardProps {
	task: Task;
	onClick?: () => void;
	isActive?: boolean;
	isDragging?: boolean;
	dragHandleProps?: React.HTMLAttributes<HTMLDivElement>;
	tools?: readonly Tool[];
	onToolClick?: (toolId: string, taskId: string) => void;
}

export function TaskCard({
	task,
	onClick,
	isActive,
	isDragging,
	dragHandleProps,
	tools,
	onToolClick,
}: TaskCardProps) {
	const statusConfig = STATUS_CONFIG[task.status];

	return (
		// biome-ignore lint/a11y/noStaticElementInteractions: role and handlers are conditionally applied based on onClick
		<div
			data-task-card
			role={onClick ? "button" : undefined}
			tabIndex={onClick ? 0 : undefined}
			className={cn(
				"flex flex-col gap-3 rounded-lg border border-border bg-card p-4",
				"transition-shadow",
				"hover:shadow-md",
				isActive && "ring-2 ring-accent",
				isDragging && "shadow-lg ring-2 ring-border",
				onClick && "cursor-pointer",
			)}
			onClick={onClick}
			onKeyDown={
				onClick
					? (e) => {
							if (e.key === "Enter" || e.key === " ") onClick();
						}
					: undefined
			}
			{...dragHandleProps}
		>
			{/* Title */}
			<h4 className="text-sm font-medium text-primary-foreground line-clamp-2">
				{task.title}
			</h4>

			{/* Description */}
			{task.description && (
				<p className="text-[13px] leading-normal text-secondary-foreground line-clamp-2">
					{task.description}
				</p>
			)}

			{/* Meta Row */}
			<div className="flex items-center justify-between">
				<div className={`rounded px-2 py-1 ${statusConfig.bgColor}`}>
					<span className={`text-xs font-medium ${statusConfig.color}`}>
						{statusConfig.label}
					</span>
				</div>
				{tools && tools.length > 0 && (
					<div className="flex items-center gap-1">
						{tools.map((tool) => {
							const IconComponent = getIconComponent(tool.icon);
							return (
								<button
									type="button"
									key={tool.id}
									className="flex h-6 w-6 items-center justify-center rounded bg-hover text-muted hover:text-secondary-foreground"
									onClick={(e) => {
										e.stopPropagation();
										onToolClick?.(tool.id, task.id);
									}}
									title={tool.name}
								>
									{IconComponent && <IconComponent className="h-3 w-3" />}
								</button>
							);
						})}
					</div>
				)}
			</div>
		</div>
	);
}
