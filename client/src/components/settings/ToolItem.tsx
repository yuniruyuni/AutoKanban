import { Pencil, Trash2 } from "lucide-react";
import { DynamicIcon } from "@/components/atoms/DynamicIcon";
import { cn } from "@/lib/utils";

interface ToolItemProps {
	name: string;
	command: string;
	iconName: string;
	iconColor: string;
	onEdit: () => void;
	onDelete: () => void;
	className?: string;
}

export function ToolItem({
	name,
	command,
	iconName,
	iconColor,
	onEdit,
	onDelete,
	className,
}: ToolItemProps) {
	return (
		<div
			className={cn(
				"flex items-center gap-4 py-4 px-5 border border-border",
				className,
			)}
		>
			<div
				className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md"
				style={{ backgroundColor: iconColor }}
			>
				<DynamicIcon name={iconName} className="h-5 w-5 text-white" />
			</div>
			<div className="min-w-0 flex-1 flex flex-col gap-1">
				<p className="text-[15px] font-semibold text-primary-foreground">{name}</p>
				<p className="truncate text-xs text-muted font-mono">{command}</p>
			</div>
			<div className="flex shrink-0 items-center gap-2">
				<button
					type="button"
					onClick={onEdit}
					className="flex items-center justify-center h-8 w-8 rounded text-muted hover:bg-hover hover:text-secondary-foreground transition-colors"
					aria-label={`Edit ${name}`}
				>
					<Pencil className="h-4 w-4" />
				</button>
				<button
					type="button"
					onClick={onDelete}
					className="flex items-center justify-center h-8 w-8 rounded text-muted hover:bg-red-50 hover:text-destructive transition-colors"
					aria-label={`Delete ${name}`}
				>
					<Trash2 className="h-4 w-4" />
				</button>
			</div>
		</div>
	);
}
