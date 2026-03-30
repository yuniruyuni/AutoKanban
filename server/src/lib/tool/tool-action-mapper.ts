/**
 * Tool Action Mapper
 *
 * Maps Claude Code tool names and inputs to structured ToolAction types
 * for rich rendering in the chat UI.
 */

import type { ToolAction } from "../conversation/types";

/**
 * Map tool name and input to a structured ToolAction
 */
export function mapToolNameToAction(
	toolName: string,
	input: Record<string, unknown>,
): ToolAction {
	switch (toolName) {
		case "Read":
			return {
				type: "file_read",
				path: (input.file_path as string) ?? "",
			};

		case "Edit":
			return {
				type: "file_edit",
				path: (input.file_path as string) ?? "",
				oldString: input.old_string as string | undefined,
				newString: input.new_string as string | undefined,
			};

		case "Write":
			return {
				type: "file_write",
				path: (input.file_path as string) ?? "",
			};

		case "Bash":
			return {
				type: "command",
				command: (input.command as string) ?? "",
			};

		case "Grep":
			return {
				type: "search",
				query: (input.pattern as string) ?? "",
				pattern: input.pattern as string | undefined,
				path: input.path as string | undefined,
			};

		case "Glob":
			return {
				type: "search",
				query: (input.pattern as string) ?? "",
				pattern: input.pattern as string | undefined,
				path: input.path as string | undefined,
			};

		case "WebFetch":
			return {
				type: "web_fetch",
				url: (input.url as string) ?? "",
			};

		case "WebSearch":
			return {
				type: "web_fetch",
				url: `search: ${(input.query as string) ?? ""}`,
			};

		case "Task":
			return {
				type: "task",
				description:
					(input.prompt as string) ?? (input.description as string) ?? "",
				subagentType: input.subagent_type as string | undefined,
			};

		case "TodoWrite": {
			const todos =
				(input.todos as Array<{
					id?: string;
					content?: string;
					status?: string;
					priority?: string;
					description?: string;
				}>) ?? [];
			return {
				type: "todo_management",
				todos: todos.map((t) => ({
					content: t.content ?? "",
					status: t.status ?? "pending",
					description: t.description,
				})),
			};
		}

		case "ExitPlanMode":
			return {
				type: "plan",
				plan: input.plan as string | undefined,
				allowedPrompts: input.allowedPrompts as
					| Array<{ tool: string; prompt: string }>
					| undefined,
			};

		default:
			return {
				type: "generic",
				input,
			};
	}
}

/**
 * Get a short human-readable label for the tool action
 */
export function getActionLabel(action: ToolAction): string {
	switch (action.type) {
		case "file_read":
			return action.path;
		case "file_edit":
			return action.path;
		case "file_write":
			return action.path;
		case "command":
			// Truncate long commands
			return action.command.length > 50
				? `${action.command.substring(0, 50)}...`
				: action.command;
		case "search":
			return action.pattern ?? action.query;
		case "web_fetch":
			return action.url;
		case "task":
			return action.subagentType ?? "task";
		case "plan":
			return "Plan";
		case "todo_management":
			return `${action.todos.length} items`;
		case "generic":
			return "";
	}
}
