import { AlertCircle } from "lucide-react";
import type { ErrorContent } from "./types";

interface ErrorMessageProps {
	content: ErrorContent;
}

export function ErrorMessage({ content }: ErrorMessageProps) {
	return (
		<div className="flex items-start gap-2 rounded-md border border-destructive bg-destructive/10 px-3 py-2">
			<AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-destructive" />
			<p className="font-mono text-sm text-destructive">{content.message}</p>
		</div>
	);
}
