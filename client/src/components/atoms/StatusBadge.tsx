import { STATUS_CONFIG } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { TaskStatus } from "@/store/task";

interface StatusBadgeProps {
	status: TaskStatus;
	label?: string;
	className?: string;
}

export function StatusBadge({ status, label, className }: StatusBadgeProps) {
	const config = STATUS_CONFIG[status];

	return (
		<span
			className={cn(
				"inline-flex items-center rounded-sm px-2.5 py-1 text-xs font-semibold",
				config.bgColor,
				config.color,
				className,
			)}
		>
			{label ?? config.label}
		</span>
	);
}
