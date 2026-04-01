/**
 * Claude Code JSON Output Parser
 *
 * Parses Claude Code's JSON stream output in protocol mode.
 * Extracts session IDs and message IDs for resumption support.
 */

import type {
	ClaudeAssistantMessage,
	ClaudeContentItem,
	ClaudeControlRequestMessage,
	ClaudeJsonMessage,
	ClaudeResultMessage,
	ClaudeUserMessage,
} from "../../models/claude-protocol";

// Re-export types for consumers
export type {
	ClaudeAssistantMessage,
	ClaudeContentItem,
	ClaudeControlRequestMessage,
	ClaudeControlResponseMessage,
	ClaudeJsonMessage,
	ClaudePartialAssistantMessage,
	ClaudeResultMessage,
	ClaudeSystemMessage,
	ClaudeUserMessage,
} from "../../models/claude-protocol";

// ============================================
// Parsed Result Types
// ============================================

export type ParsedResult =
	| { kind: "session_id"; value: string }
	| { kind: "message_id"; value: string }
	| { kind: "message"; data: ClaudeJsonMessage }
	| { kind: "result"; data: ClaudeResultMessage }
	| { kind: "control_request"; data: ClaudeControlRequestMessage }
	| { kind: "error"; error: string };

// ============================================
// Claude JSON Parser
// ============================================

export class ClaudeJsonParser {
	private sessionIdExtracted = false;
	private pendingAssistantUuid: string | null = null;
	private extractedSessionId: string | null = null;

	/**
	 * Parse a single line of JSON output from Claude Code.
	 * Returns parsed results including session/message IDs when found.
	 */
	parse(line: string): ParsedResult[] {
		const results: ParsedResult[] = [];

		if (!line.trim()) {
			return results;
		}

		let json: ClaudeJsonMessage;
		try {
			json = JSON.parse(line) as ClaudeJsonMessage;
		} catch (e) {
			return [{ kind: "error", error: `Failed to parse JSON: ${e}` }];
		}

		// Extract session_id (first one found)
		const sessionId = this.extractSessionId(json);
		if (!this.sessionIdExtracted && sessionId) {
			this.sessionIdExtracted = true;
			this.extractedSessionId = sessionId;
			results.push({ kind: "session_id", value: sessionId });
		}

		// Track message UUIDs for --resume-session-at:
		// - User messages: always valid, push immediately and clear pending
		// - Assistant messages: may have incomplete tool calls, store as pending
		// - Result messages: confirms assistant turn is complete, commit pending
		switch (json.type) {
			case "user": {
				const userMsg = json as ClaudeUserMessage;
				this.pendingAssistantUuid = null;
				if (userMsg.uuid) {
					results.push({ kind: "message_id", value: userMsg.uuid });
				}
				break;
			}
			case "assistant": {
				const assistantMsg = json as ClaudeAssistantMessage;
				this.pendingAssistantUuid = assistantMsg.uuid ?? null;
				break;
			}
			case "result": {
				if (this.pendingAssistantUuid) {
					results.push({
						kind: "message_id",
						value: this.pendingAssistantUuid,
					});
					this.pendingAssistantUuid = null;
				}
				results.push({ kind: "result", data: json as ClaudeResultMessage });
				break;
			}
			case "control_request": {
				results.push({
					kind: "control_request",
					data: json as ClaudeControlRequestMessage,
				});
				break;
			}
			default:
				// All other message types
				results.push({ kind: "message", data: json });
		}

		return results;
	}

	/**
	 * Extract session_id from any message type that contains it.
	 */
	private extractSessionId(json: ClaudeJsonMessage): string | null {
		if ("session_id" in json && json.session_id) {
			return json.session_id;
		}
		return null;
	}

	/**
	 * Get the extracted session ID (if any).
	 */
	getSessionId(): string | null {
		return this.extractedSessionId;
	}

	/**
	 * Reset the parser state for a new session.
	 */
	reset(): void {
		this.sessionIdExtracted = false;
		this.pendingAssistantUuid = null;
		this.extractedSessionId = null;
	}
}

// ============================================
// Helper Functions
// ============================================

/**
 * Extract text content from assistant message.
 */
export function extractTextFromAssistant(msg: ClaudeAssistantMessage): string {
	const texts: string[] = [];

	for (const item of msg.message.content) {
		if (item.type === "text") {
			texts.push(item.text);
		}
	}

	return texts.join("\n");
}

/**
 * Check if a result indicates an error.
 */
export function isErrorResult(result: ClaudeResultMessage): boolean {
	return result.is_error === true || !!result.error;
}

/**
 * Extract summary from the last assistant message before result.
 * This can be used to store a summary of the agent's final response.
 */
export function extractSummaryFromContent(
	content: ClaudeContentItem[],
): string | null {
	// Find the last text content
	for (let i = content.length - 1; i >= 0; i--) {
		const item = content[i];
		if (item.type === "text" && item.text.trim()) {
			// Truncate if too long
			const text = item.text.trim();
			if (text.length > 500) {
				return `${text.substring(0, 497)}...`;
			}
			return text;
		}
	}
	return null;
}
