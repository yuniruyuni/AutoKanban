import { Brain, ChevronRight } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import type { ThinkingContent } from "./types";

interface ThinkingMessageProps {
	content: ThinkingContent;
}

export function ThinkingMessage({ content }: ThinkingMessageProps) {
	const [expanded, setExpanded] = useState(false);

	return (
		<div className="ml-11">
			<button
				type="button"
				onClick={() => setExpanded(!expanded)}
				className="flex items-center gap-2 text-muted transition-colors hover:text-secondary-foreground"
			>
				<Brain className="h-4 w-4" />
				<span className="text-sm">Thinking...</span>
				<ChevronRight
					className={cn(
						"h-4 w-4 transition-transform",
						expanded && "rotate-90",
					)}
				/>
			</button>
			{expanded && (
				<div className="mt-2 rounded-lg bg-secondary p-3">
					<p className="whitespace-pre-wrap text-sm italic text-muted">
						{content.thinking}
					</p>
				</div>
			)}
		</div>
	);
}
