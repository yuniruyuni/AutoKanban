/**
 * Conversation types for displaying Claude Code conversation in UI
 *
 * - ToolEntry combines tool_use and tool_result into a single entry with status tracking
 * - ToolAction provides tool-specific structured data for rich rendering
 * - ToolStatus tracks execution state (running/success/failed)
 */

/**
 * ConversationEntry - A single unit displayed in the chat UI
 */
export interface ConversationEntry {
	id: string;
	timestamp: string;
	type: EntryType;
	messageUuid?: string;
}

/**
 * EntryType - Determines display format (discriminated union)
 */
export type EntryType =
	| UserMessageEntry
	| AssistantMessageEntry
	| ToolEntry
	| ThinkingEntry
	| SystemMessageEntry
	| ErrorEntry
	| UserFeedbackEntry
	| TokenUsageEntry;

/**
 * User message
 */
export interface UserMessageEntry {
	kind: "user_message";
	text: string;
}

/**
 * Assistant message
 */
export interface AssistantMessageEntry {
	kind: "assistant_message";
	text: string;
}

/**
 * Tool entry - Combines tool invocation and result
 */
export interface ToolEntry {
	kind: "tool";
	toolId: string;
	toolName: string;
	status: ToolStatus;
	action: ToolAction;
	result?: ToolResult;
	permissionRequestId?: string;
}

export type ToolStatus =
	| "running"
	| "success"
	| "failed"
	| "pending_approval"
	| "denied"
	| "timed_out";

/**
 * Tool action - Tool-specific structured data
 */
export type ToolAction =
	| FileReadAction
	| FileEditAction
	| FileWriteAction
	| CommandAction
	| SearchAction
	| WebFetchAction
	| TaskAction
	| PlanAction
	| TodoManagementAction
	| GenericAction;

export interface FileReadAction {
	type: "file_read";
	path: string;
}

export interface FileEditAction {
	type: "file_edit";
	path: string;
	oldString?: string;
	newString?: string;
}

export interface FileWriteAction {
	type: "file_write";
	path: string;
}

export interface CommandAction {
	type: "command";
	command: string;
}

export interface SearchAction {
	type: "search";
	query: string;
	pattern?: string;
	path?: string;
}

export interface WebFetchAction {
	type: "web_fetch";
	url: string;
}

export interface TaskAction {
	type: "task";
	description: string;
	subagentType?: string;
}

export interface PlanAction {
	type: "plan";
	plan?: string;
	planFile?: string;
	allowedPrompts?: Array<{ tool: string; prompt: string }>;
	planStatus?: PlanStatus;
	approvalId?: string;
}

export interface TodoManagementAction {
	type: "todo_management";
	todos: Array<{ content: string; status: string; description?: string }>;
}

export interface GenericAction {
	type: "generic";
	input: Record<string, unknown>;
}

/**
 * Tool result
 */
export interface ToolResult {
	output: string;
	isError: boolean;
	exitCode?: number;
}

/**
 * Thinking entry
 */
export interface ThinkingEntry {
	kind: "thinking";
	thinking: string;
}

/**
 * System message entry
 */
export interface SystemMessageEntry {
	kind: "system_message";
	text: string;
}

/**
 * Error entry
 */
export interface ErrorEntry {
	kind: "error";
	message: string;
}

/**
 * Token usage entry - Displayed as usage gauge
 */
export interface TokenUsageEntry {
	kind: "token_usage";
	inputTokens: number;
	outputTokens: number;
	totalTokens: number;
	contextWindow: number;
}

/**
 * User feedback entry - Displayed when user denies a tool with feedback
 */
export interface UserFeedbackEntry {
	kind: "user_feedback";
	toolName: string;
	reason: string;
}

/**
 * Plan entry - Displayed when Claude exits plan mode
 */
export interface PlanEntry {
	kind: "plan";
	toolId: string;
	planContent: string;
	status: PlanStatus;
}

export type PlanStatus = "pending" | "approved" | "rejected";
