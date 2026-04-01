/**
 * Claude Code Protocol Types
 *
 * Type definitions for Claude Code's JSON stream output in protocol mode.
 * Reconstructed to align with the official @anthropic-ai/claude-agent-sdk schema.
 */

// ============================================
// Content Item Types
// ============================================

export type ClaudeContentItem =
	| { type: "text"; text: string }
	| { type: "thinking"; thinking: string }
	| {
			type: "tool_use";
			id: string;
			name: string;
			input: Record<string, unknown>;
	  }
	| {
			type: "tool_result";
			tool_use_id: string;
			content: unknown;
			is_error?: boolean;
	  };

// ============================================
// Core Message Types
// ============================================

// System message (initial setup info)
export interface ClaudeSystemMessage {
	type: "system";
	subtype: "init";
	agents?: string[];
	apiKeySource?: string;
	betas?: string[];
	claude_code_version?: string;
	cwd?: string;
	model?: string;
	tools?: string[];
	mcp_servers?: { name: string; status: string }[];
	permissionMode?: string;
	slash_commands?: string[];
	output_style?: string;
	skills?: string[];
	plugins?: { name: string; path: string }[];
	fast_mode_state?: "off" | "cooldown" | "on";
	uuid?: string;
	session_id?: string;
}

// Assistant message
export interface ClaudeAssistantMessage {
	type: "assistant";
	message: {
		role: "assistant";
		content: ClaudeContentItem[];
	};
	parent_tool_use_id?: string | null;
	error?: string;
	uuid?: string;
	session_id?: string;
}

// User message
export interface ClaudeUserMessage {
	type: "user";
	message: {
		role: "user";
		content: string | ClaudeContentItem[];
	};
	parent_tool_use_id?: string | null;
	isSynthetic?: boolean;
	isReplay?: boolean;
	tool_use_result?: unknown;
	priority?: "now" | "next" | "later";
	timestamp?: string;
	uuid?: string;
	session_id?: string;
	file_attachments?: unknown[];
}

// Result message (turn completion)
export interface ClaudeResultMessage {
	type: "result";
	subtype?:
		| "success"
		| "error_during_execution"
		| "error_max_turns"
		| "error_max_budget_usd"
		| "error_max_structured_output_retries";
	is_error?: boolean;
	error?: string;
	duration_ms?: number;
	duration_api_ms?: number;
	num_turns?: number;
	result?: string;
	stop_reason?: string | null;
	total_cost_usd?: number;
	usage?: Record<string, unknown>;
	session_id?: string;
	uuid?: string;
}

// ============================================
// Streaming
// ============================================

export interface ClaudePartialAssistantMessage {
	type: "stream_event";
	event: { type: string; [key: string]: unknown };
	parent_tool_use_id?: string | null;
	uuid?: string;
	session_id?: string;
}

// ============================================
// System Subtypes
// ============================================

export interface ClaudeCompactBoundaryMessage {
	type: "system";
	subtype: "compact_boundary";
	compact_metadata: {
		trigger: "manual" | "auto";
		pre_tokens: number;
		preserved_segment?: {
			head_uuid: string;
			anchor_uuid: string;
			tail_uuid: string;
		};
	};
	uuid?: string;
	session_id?: string;
}

export interface ClaudeStatusMessage {
	type: "system";
	subtype: "status";
	status: "compacting" | null;
	permissionMode?: string;
	uuid?: string;
	session_id?: string;
}

export interface ClaudeAPIRetryMessage {
	type: "system";
	subtype: "api_retry";
	attempt: number;
	max_retries: number;
	retry_delay_ms: number;
	error_status: number | null;
	error: string;
	uuid?: string;
	session_id?: string;
}

export interface ClaudeLocalCommandOutputMessage {
	type: "system";
	subtype: "local_command_output";
	content: string;
	uuid?: string;
	session_id?: string;
}

export interface ClaudeHookStartedMessage {
	type: "system";
	subtype: "hook_started";
	hook_id: string;
	hook_name: string;
	hook_event: string;
	uuid?: string;
	session_id?: string;
}

export interface ClaudeHookProgressMessage {
	type: "system";
	subtype: "hook_progress";
	hook_id: string;
	hook_name: string;
	hook_event: string;
	stdout: string;
	stderr: string;
	output: string;
	uuid?: string;
	session_id?: string;
}

export interface ClaudeHookResponseMessage {
	type: "system";
	subtype: "hook_response";
	hook_id: string;
	hook_name: string;
	hook_event: string;
	output: string;
	stdout: string;
	stderr: string;
	exit_code?: number;
	outcome: "success" | "error" | "cancelled";
	uuid?: string;
	session_id?: string;
}

export interface ClaudeTaskStartedMessage {
	type: "system";
	subtype: "task_started";
	task_id: string;
	tool_use_id?: string;
	description: string;
	task_type?: string;
	workflow_name?: string;
	prompt?: string;
	uuid?: string;
	session_id?: string;
}

export interface ClaudeTaskProgressMessage {
	type: "system";
	subtype: "task_progress";
	task_id: string;
	tool_use_id?: string;
	description: string;
	usage: { total_tokens: number; tool_uses: number; duration_ms: number };
	last_tool_name?: string;
	summary?: string;
	uuid?: string;
	session_id?: string;
}

export interface ClaudeTaskNotificationMessage {
	type: "system";
	subtype: "task_notification";
	task_id: string;
	tool_use_id?: string;
	status: "completed" | "failed" | "stopped";
	output_file: string;
	summary: string;
	usage?: { total_tokens: number; tool_uses: number; duration_ms: number };
	uuid?: string;
	session_id?: string;
}

export interface ClaudeSessionStateChangedMessage {
	type: "system";
	subtype: "session_state_changed";
	state: "idle" | "running" | "requires_action";
	uuid?: string;
	session_id?: string;
}

export interface ClaudeFilesPersistedEvent {
	type: "system";
	subtype: "files_persisted";
	files: { filename: string; file_id: string }[];
	failed: { filename: string; error: string }[];
	processed_at: string;
	uuid?: string;
	session_id?: string;
}

export interface ClaudeElicitationCompleteMessage {
	type: "system";
	subtype: "elicitation_complete";
	mcp_server_name: string;
	elicitation_id: string;
	uuid?: string;
	session_id?: string;
}

// ============================================
// Tool Progress / Summary
// ============================================

export interface ClaudeToolProgressMessage {
	type: "tool_progress";
	tool_use_id: string;
	tool_name: string;
	parent_tool_use_id?: string | null;
	elapsed_time_seconds: number;
	task_id?: string;
	uuid?: string;
	session_id?: string;
}

export interface ClaudeToolUseSummaryMessage {
	type: "tool_use_summary";
	summary: string;
	preceding_tool_use_ids: string[];
	uuid?: string;
	session_id?: string;
}

// ============================================
// Auth / Rate Limit
// ============================================

export interface ClaudeAuthStatusMessage {
	type: "auth_status";
	isAuthenticating: boolean;
	output: string[];
	error?: string;
	uuid?: string;
	session_id?: string;
}

export interface ClaudeRateLimitEvent {
	type: "rate_limit_event";
	rate_limit_info: {
		status: "allowed" | "allowed_warning" | "rejected";
		resetsAt?: number;
		rateLimitType?: string;
		utilization?: number;
		overageStatus?: "allowed" | "allowed_warning" | "rejected";
		overageResetsAt?: number;
		overageDisabledReason?: string;
		isUsingOverage?: boolean;
		surpassedThreshold?: number;
	};
	uuid?: string;
	session_id?: string;
}

// ============================================
// Misc
// ============================================

export interface ClaudePromptSuggestionMessage {
	type: "prompt_suggestion";
	suggestion: string;
	uuid?: string;
	session_id?: string;
}

// ============================================
// Control Protocol
// ============================================

export interface ClaudeControlRequestMessage {
	type: "control_request";
	request_id: string;
	request: {
		subtype: string;
		[key: string]: unknown;
	};
}

export interface ClaudeControlResponseMessage {
	type: "control_response";
	response: {
		subtype: string;
		[key: string]: unknown;
	};
}

export interface ClaudeControlCancelRequest {
	type: "control_cancel_request";
	request_id: string;
}

export interface ClaudeKeepAliveMessage {
	type: "keep_alive";
}

// ============================================
// Union Type
// ============================================

export type ClaudeJsonMessage =
	// Core message types
	| ClaudeSystemMessage
	| ClaudeAssistantMessage
	| ClaudeUserMessage
	| ClaudeResultMessage
	// Streaming
	| ClaudePartialAssistantMessage
	// System subtypes
	| ClaudeCompactBoundaryMessage
	| ClaudeStatusMessage
	| ClaudeAPIRetryMessage
	| ClaudeLocalCommandOutputMessage
	| ClaudeHookStartedMessage
	| ClaudeHookProgressMessage
	| ClaudeHookResponseMessage
	| ClaudeTaskStartedMessage
	| ClaudeTaskProgressMessage
	| ClaudeTaskNotificationMessage
	| ClaudeSessionStateChangedMessage
	| ClaudeFilesPersistedEvent
	| ClaudeElicitationCompleteMessage
	// Tool progress/summary
	| ClaudeToolProgressMessage
	| ClaudeToolUseSummaryMessage
	// Auth/rate limit
	| ClaudeAuthStatusMessage
	| ClaudeRateLimitEvent
	// Misc
	| ClaudePromptSuggestionMessage
	// Control protocol
	| ClaudeControlRequestMessage
	| ClaudeControlResponseMessage
	| ClaudeControlCancelRequest
	| ClaudeKeepAliveMessage;
