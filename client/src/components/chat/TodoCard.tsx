import {
	CheckCircle2,
	ChevronDown,
	ChevronUp,
	Circle,
	CircleDot,
	ListChecks,
} from "lucide-react";
import { useState } from "react";
import type { TodoManagementAction, ToolEntry as ToolEntryType } from "./types";

interface TodoCardProps {
	entry: ToolEntryType;
}

function StatusIcon({ status }: { status: string }) {
	switch (status) {
		case "completed":
			return <CheckCircle2 className="h-4 w-4 text-success" />;
		case "in_progress":
			return <CircleDot className="h-4 w-4 text-accent" />;
		default:
			return <Circle className="h-4 w-4 text-muted" />;
	}
}

/**
 * TodoCard - Dedicated card for TodoWrite tool results.
 *
 * Displays todo items as a collapsible checklist with progress badge.
 * Defaults to collapsed since TodoWrite calls are frequent.
 */
export function TodoCard({ entry }: TodoCardProps) {
	const [expanded, setExpanded] = useState(false);

	const todoAction = entry.action as TodoManagementAction;
	const todos = todoAction.todos;
	const completed = todos.filter((t) => t.status === "completed").length;
	const total = todos.length;

	return (
		<div className="ml-9 overflow-hidden rounded-lg border border-border bg-secondary">
			{/* Header */}
			<button
				type="button"
				onClick={() => setExpanded(!expanded)}
				className="flex w-full items-center gap-3 bg-secondary px-4 py-3 transition-colors hover:bg-hover"
			>
				<ListChecks className="h-5 w-5 text-purple-500" />
				<span className="text-base font-semibold text-secondary-foreground">
					Updated Todos
				</span>
				<span className="rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700">
					{completed}/{total}
				</span>
				<span className="ml-auto">
					{expanded ? (
						<ChevronUp className="h-4 w-4 text-muted" />
					) : (
						<ChevronDown className="h-4 w-4 text-muted" />
					)}
				</span>
			</button>

			{/* Todo list */}
			{expanded && (
				<div className="border-t border-border p-4">
					<ul className="space-y-2">
						{todos.map((todo, i) => (
							// biome-ignore lint/suspicious/noArrayIndexKey: items have no stable unique identifier
							<li key={i} className="flex items-start gap-2">
								<StatusIcon status={todo.status} />
								<div className="flex-1">
									<span className="text-sm text-secondary-foreground">
										{todo.content}
									</span>
									{todo.description && (
										<p className="mt-0.5 text-xs text-muted">
											{todo.description}
										</p>
									)}
								</div>
							</li>
						))}
					</ul>
				</div>
			)}
		</div>
	);
}
