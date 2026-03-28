import { ChevronDown, ChevronRight } from "lucide-react";
import { type ReactNode, useState } from "react";
import { cn } from "@/lib/utils";

interface PreviousTurnCardProps {
	turnNumber: number;
	summary: string;
	children: ReactNode;
	defaultExpanded?: boolean;
	className?: string;
}

export function PreviousTurnCard({
	turnNumber,
	summary,
	children,
	defaultExpanded = false,
	className,
}: PreviousTurnCardProps) {
	const [expanded, setExpanded] = useState(defaultExpanded);

	return (
		<div className={cn("rounded-md border bg-card", className)}>
			<button
				type="button"
				onClick={() => setExpanded(!expanded)}
				className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-hover"
			>
				{expanded ? (
					<ChevronDown className="h-4 w-4 shrink-0 text-muted" />
				) : (
					<ChevronRight className="h-4 w-4 shrink-0 text-muted" />
				)}
				<span className="text-sm font-medium text-primary">
					Turn {turnNumber}
				</span>
				<span className="truncate text-sm text-muted">{summary}</span>
			</button>
			{expanded && <div className="border-t px-3 py-2">{children}</div>}
		</div>
	);
}
