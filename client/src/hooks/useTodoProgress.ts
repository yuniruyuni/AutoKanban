import { useMemo } from "react";
import type {
	ConversationEntry,
	TodoManagementAction,
	ToolEntry,
} from "@/components/chat/types";

export interface TodoProgressState {
	todos: Array<{ content: string; status: string; description?: string }>;
	completed: number;
	total: number;
	percentage: number;
}

/**
 * Extracts the latest todo progress from conversation entries.
 * Scans from the end for the most recent todo_management entry.
 */
export function useTodoProgress(
	entries: ConversationEntry[],
): TodoProgressState {
	return useMemo(() => {
		// Scan from the end for the most recent todo_management entry
		for (let i = entries.length - 1; i >= 0; i--) {
			const entry = entries[i];
			if (entry.type.kind !== "tool") continue;

			const toolEntry = entry.type as ToolEntry;
			if (toolEntry.action.type !== "todo_management") continue;

			const todoAction = toolEntry.action as TodoManagementAction;
			const todos = todoAction.todos;
			const completed = todos.filter((t) => t.status === "completed").length;
			const total = todos.length;
			const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

			return { todos, completed, total, percentage };
		}

		return { todos: [], completed: 0, total: 0, percentage: 0 };
	}, [entries]);
}
