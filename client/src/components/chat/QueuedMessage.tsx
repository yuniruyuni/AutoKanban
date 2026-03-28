import { Timer, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface QueuedMessageProps {
	message: string;
	onClear: () => void;
	className?: string;
}

export function QueuedMessage({
	message,
	onClear,
	className,
}: QueuedMessageProps) {
	return (
		<div
			className={cn(
				"flex items-center gap-2 rounded-md border bg-card px-3 py-2",
				className,
			)}
		>
			<Timer className="h-4 w-4 shrink-0 text-muted" />
			<span className="text-xs font-medium text-muted">Queued:</span>
			<span className="flex-1 truncate text-sm text-primary">{message}</span>
			<button
				type="button"
				onClick={onClear}
				className="shrink-0 rounded p-0.5 text-muted hover:bg-hover hover:text-primary"
				aria-label="Clear queued message"
			>
				<X className="h-3.5 w-3.5" />
			</button>
		</div>
	);
}
