import { Info } from "lucide-react";
import type { SystemContent } from "./types";

interface SystemMessageProps {
	content: SystemContent;
}

export function SystemMessage({ content }: SystemMessageProps) {
	return (
		<div className="flex items-start gap-2 rounded-lg border bg-secondary px-3 py-2">
			<Info className="mt-0.5 h-4 w-4 flex-shrink-0 text-muted" />
			<p className="text-sm text-secondary-foreground">{content.text}</p>
		</div>
	);
}
