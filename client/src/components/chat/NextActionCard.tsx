import { GitCompare, Play, RefreshCw } from "lucide-react";
import type { ConversationEntry } from "./types";

interface NextActionCardProps {
	entries: ConversationEntry[];
	onRetry?: () => void;
	onOpenDiffs?: () => void;
	onStartAgent?: () => void;
}

function computeDiffStats(entries: ConversationEntry[]): {
	files: number;
	added: number;
	removed: number;
} {
	const editedFiles = new Set<string>();
	let added = 0;
	let removed = 0;

	for (const entry of entries) {
		if (entry.type.kind !== "tool") continue;
		const action = entry.type.action;
		if (action.type === "file_edit") {
			editedFiles.add(action.path);
			if (action.newString) added += action.newString.split("\n").length;
			if (action.oldString) removed += action.oldString.split("\n").length;
		} else if (action.type === "file_write") {
			editedFiles.add(action.path);
		}
	}

	return { files: editedFiles.size, added, removed };
}

export function NextActionCard({
	entries,
	onRetry,
	onOpenDiffs,
	onStartAgent,
}: NextActionCardProps) {
	const { files, added, removed } = computeDiffStats(entries);

	// Don't render if there's nothing to show
	const hasActions = !!onRetry || (!!onOpenDiffs && files > 0) || !!onStartAgent;
	if (!hasActions && files === 0) return null;

	return (
		<div className="ml-9 rounded-lg border bg-secondary p-4">
			{/* Diff stats */}
			{files > 0 && (
				<div className="mb-3 flex items-center gap-3 text-sm">
					<span className="text-secondary-foreground">
						{files} file{files > 1 ? "s" : ""} changed
					</span>
					{added > 0 && <span className="text-green-600">+{added}</span>}
					{removed > 0 && <span className="text-red-600">-{removed}</span>}
				</div>
			)}

			{/* Action buttons */}
			<div className="flex flex-wrap gap-2">
				{onRetry && (
					<button
						type="button"
						onClick={onRetry}
						className="flex items-center gap-1.5 rounded-md border bg-primary px-3 py-1.5 text-xs font-medium text-secondary-foreground transition-colors hover:bg-hover"
					>
						<RefreshCw className="h-3.5 w-3.5" />
						Try Again
					</button>
				)}
				{onOpenDiffs && files > 0 && (
					<button
						type="button"
						onClick={onOpenDiffs}
						className="flex items-center gap-1.5 rounded-md border bg-primary px-3 py-1.5 text-xs font-medium text-secondary-foreground transition-colors hover:bg-hover"
					>
						<GitCompare className="h-3.5 w-3.5" />
						Open Diffs
					</button>
				)}
				{onStartAgent && (
					<button
						type="button"
						onClick={onStartAgent}
						className="flex items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-accent-hover"
					>
						<Play className="h-3.5 w-3.5" />
						Start Agent
					</button>
				)}
			</div>
		</div>
	);
}
