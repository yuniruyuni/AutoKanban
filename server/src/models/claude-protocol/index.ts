/**
 * Claude Code Protocol Types
 *
 * Type definitions for Claude Code's JSON stream output in protocol mode.
 */

// ============================================
// Claude JSON Message Types
// ============================================

export type ClaudeJsonType =
	| "system"
	| "assistant"
	| "user"
	| "tool_use"
	| "tool_result"
	| "stream_event"
	| "result"
	| "control_request"
	| "control_response";

// Base message interface
interface ClaudeJsonBase {
	type: ClaudeJsonType;
	session_id?: string;
}

// System message (initial setup info)
export interface ClaudeSystemMessage extends ClaudeJsonBase {
	type: "system";
	subtype?: string;
	cwd?: string;
	model?: string;
	tools?: unknown[];
}

// Assistant message
export interface ClaudeAssistantMessage extends ClaudeJsonBase {
	type: "assistant";
	message: {
		role: "assistant";
		content: ClaudeContentItem[];
	};
	uuid?: string;
	parent_tool_use_id?: string; // Present when message is from a subagent
}

// User message
export interface ClaudeUserMessage extends ClaudeJsonBase {
	type: "user";
	message: {
		role: "user";
		content: string | ClaudeContentItem[];
	};
	uuid?: string;
	is_synthetic?: boolean;
	is_replay?: boolean;
	parent_tool_use_id?: string; // Present when message is from a subagent
}

// Tool use message
export interface ClaudeToolUseMessage extends ClaudeJsonBase {
	type: "tool_use";
	tool_name: string;
	tool_data: Record<string, unknown>;
}

// Tool result message
export interface ClaudeToolResultMessage extends ClaudeJsonBase {
	type: "tool_result";
	result: unknown;
	is_error?: boolean;
}

// Stream event (for streaming content)
export interface ClaudeStreamEventMessage extends ClaudeJsonBase {
	type: "stream_event";
	event: {
		type: string;
		[key: string]: unknown;
	};
	parent_tool_use_id?: string;
	uuid?: string;
}

// Result message (turn completion)
export interface ClaudeResultMessage extends ClaudeJsonBase {
	type: "result";
	subtype?: string;
	is_error?: boolean;
	error?: string;
	duration_ms?: number;
	num_turns?: number;
	result?: unknown;
}

// Control request (permission requests)
export interface ClaudeControlRequestMessage {
	type: "control_request";
	request_id: string;
	request: {
		subtype: string;
		[key: string]: unknown;
	};
}

// Control response
export interface ClaudeControlResponseMessage {
	type: "control_response";
	response: {
		subtype: string;
		[key: string]: unknown;
	};
}

// Content item types
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

// Union type of all messages
export type ClaudeJsonMessage =
	| ClaudeSystemMessage
	| ClaudeAssistantMessage
	| ClaudeUserMessage
	| ClaudeToolUseMessage
	| ClaudeToolResultMessage
	| ClaudeStreamEventMessage
	| ClaudeResultMessage
	| ClaudeControlRequestMessage
	| ClaudeControlResponseMessage;
