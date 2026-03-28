import { ChevronRight, Layers } from "lucide-react";
import { useState } from "react";
import type { AggregatedGroup } from "@/lib/entry-aggregator";
import { cn } from "@/lib/utils";
import { ChatMessage } from "./ChatMessage";

interface AggregatedToolGroupProps {
	group: AggregatedGroup;
	sessionId?: string | null;
	isProcessRunning?: boolean;
}

export function AggregatedToolGroup({
	group,
	sessionId,
	isProcessRunning,
}: AggregatedToolGroupProps) {
	const [expanded, setExpanded] = useState(false);

	return (
		<div className="ml-9 overflow-hidden rounded-lg border">
			<button
				type="button"
				onClick={() => setExpanded(!expanded)}
				className="flex w-full items-center gap-2 bg-secondary px-3 py-2 transition-colors hover:bg-hover"
			>
				<Layers className="h-4 w-4 text-muted" />
				<span className="text-sm font-medium text-secondary-foreground">
					{group.label}
				</span>
				<ChevronRight
					className={cn(
						"ml-auto h-4 w-4 flex-shrink-0 text-muted transition-transform",
						expanded && "rotate-90",
					)}
				/>
			</button>

			{expanded && (
				<div className="border-t border bg-primary">
					<div className="flex flex-col gap-2 p-2">
						{group.entries.map((entry) => (
							<ChatMessage key={entry.id} entry={entry} sessionId={sessionId} isProcessRunning={isProcessRunning} />
						))}
					</div>
				</div>
			)}
		</div>
	);
}
