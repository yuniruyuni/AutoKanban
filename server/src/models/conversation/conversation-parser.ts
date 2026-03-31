/**
 * Conversation Parser
 *
 * Converts raw database logs into structured ConversationEntry for UI display.
 * Uses timestamp-based splitting to handle logs that may be concatenated without newlines.
 *
 * Key features:
 * - ToolEntry combines tool_use and tool_result into a single entry with status tracking
 * - Robust parsing handles malformed or concatenated logs
 * - Supports streaming (running tools) and completed states
 * - Stable IDs based on content hash to prevent React remounting
 * - isIdle detection to know when Claude is waiting for input
 */

import { createHash } from "node:crypto";
import type {
	ClaudeAssistantMessage,
	ClaudeContentItem,
	ClaudeControlRequestMessage,
	ClaudeControlResponseMessage,
	ClaudeJsonMessage,
	ClaudeUserMessage,
} from "../claude-protocol";
import { computeIdleState } from "./idle-state";
import {
	computeDefaultPlanStatus,
	determinePlanStatusFromText,
} from "./plan-status";
import { mapToolNameToAction } from "./tool-action-mapper";
import { extractExitCode, formatToolOutput } from "./tool-result-formatter";
import {
	applyControlRequest,
	applyControlResponse,
	applyToolResult,
	type ControlResponseInput,
	normalizeControlResponse,
} from "./tool-status-machine";
import type {
	ConversationEntry,
	PlanAction,
	ToolEntry as ToolEntryType,
	ToolStatus,
} from "./types";

/**
 * Parse result containing entries and idle state
 */
export interface ParseResult {
	entries: ConversationEntry[];
	isIdle: boolean;
}

/**
 * Information about a pending (interrupted) tool use
 */
export interface PendingToolUse {
	toolId: string;
	toolName: string;
	input: Record<string, unknown>;
}

/**
 * Parsed log line structure
 */
interface ParsedLogLine {
	timestamp: string;
	source: "stdout" | "stderr";
	data: string;
}

/**
 * Timestamp regex pattern for splitting logs
 * Matches: [2024-01-15T10:30:45.123Z]
 */
const TIMESTAMP_PATTERN = /(?=\[\d{4}-\d{2}-\d{2}T[\d:.]+Z?\])/;

/**
 * Log line regex pattern
 * Captures: timestamp, source (stdout/stderr), and data
 */
const LOG_LINE_PATTERN = /^\[([^\]]+)\]\s*\[([^\]]+)\]\s*(.*)$/s;

/**
 * Generate a stable ID based on content hash.
 * This ensures the same content always gets the same ID across re-parses.
 */
function generateStableId(
	type: string,
	timestamp: string,
	content: string,
): string {
	const hash = createHash("sha256")
		.update(`${type}:${timestamp}:${content.substring(0, 200)}`)
		.digest("hex")
		.substring(0, 16);
	return `${type}-${hash}`;
}

/**
 * Generate a stable ID for tool entries using the Claude-provided tool ID.
 */
function generateToolId(toolId: string): string {
	return `tool-${toolId}`;
}

/**
 * Parse a single log line from database format.
 */
function parseLogLine(line: string): ParsedLogLine | null {
	const match = line.match(LOG_LINE_PATTERN);
	if (!match) {
		return null;
	}

	return {
		timestamp: match[1],
		source: match[2] as "stdout" | "stderr",
		data: match[3],
	};
}

/**
 * Parse raw database logs into structured ParseResult.
 */
export function parseLogsToConversation(rawLogs: string): ParseResult {
	// Split by timestamp pattern to handle concatenated logs
	const lines = rawLogs.split(TIMESTAMP_PATTERN).filter(Boolean);

	const entries: ConversationEntry[] = [];
	const pendingTools = new Map<string, ConversationEntry>(); // toolId -> entry
	const completedPlanTools = new Map<string, ConversationEntry>(); // toolId -> entry (for plan status detection)
	let isIdle = false;

	for (const line of lines) {
		const parsed = parseLogLine(line);
		if (!parsed) continue;

		const { timestamp, source, data } = parsed;

		// stderr -> error entry
		if (source === "stderr") {
			const trimmedData = data.trim();
			if (trimmedData) {
				entries.push({
					id: generateStableId("error", timestamp, trimmedData),
					timestamp,
					type: {
						kind: "error",
						message: trimmedData,
					},
				});
			}
			continue;
		}

		// stdout -> parse JSON
		try {
			const json = JSON.parse(data) as ClaudeJsonMessage;

			// Track idle state based on message type
			const controlSubtype =
				json.type === "control_request"
					? (json as ClaudeControlRequestMessage).request.subtype
					: undefined;
			const idleChange = computeIdleState(json.type, controlSubtype);
			if (idleChange !== null) {
				isIdle = idleChange;
			}

			const result = processClaudeJson(
				json,
				timestamp,
				pendingTools,
				completedPlanTools,
			);
			if (result) {
				entries.push(...result);
			}
		} catch {
			// Non-JSON output - skip silently
		}
	}

	// Set default plan status for completed plan tools that haven't been approved/rejected
	for (const [, entry] of completedPlanTools) {
		if (entry.type.kind === "tool") {
			const toolType = entry.type as ToolEntryType;
			if (toolType.action.type === "plan" && !toolType.action.planStatus) {
				toolType.action.planStatus = computeDefaultPlanStatus(toolType.status);
			}
		}
	}

	return { entries, isIdle };
}

/**
 * Process a Claude JSON message and return ConversationEntry array.
 */
function processClaudeJson(
	json: ClaudeJsonMessage,
	timestamp: string,
	pendingTools: Map<string, ConversationEntry>,
	completedPlanTools: Map<string, ConversationEntry>,
): ConversationEntry[] | null {
	switch (json.type) {
		case "assistant":
			return processAssistantMessage(
				json as ClaudeAssistantMessage,
				timestamp,
				pendingTools,
				completedPlanTools,
			);

		case "user":
			return processUserMessage(
				json as ClaudeUserMessage,
				timestamp,
				pendingTools,
				completedPlanTools,
			);

		case "system":
			// Skip system messages (initial setup info)
			return null;

		case "result": {
			// Extract token usage from result messages
			const resultMsg =
				json as import("../../models/claude-protocol").ClaudeResultMessage;
			const usage = (resultMsg as unknown as Record<string, unknown>).usage as
				| {
						input_tokens?: number;
						output_tokens?: number;
						context_window?: number;
				  }
				| undefined;

			if (usage && usage.input_tokens !== undefined) {
				const inputTokens = usage.input_tokens ?? 0;
				const outputTokens = usage.output_tokens ?? 0;
				const contextWindow = usage.context_window ?? 200000;
				return [
					{
						id: generateStableId(
							"token_usage",
							timestamp,
							`${inputTokens}:${outputTokens}`,
						),
						timestamp,
						type: {
							kind: "token_usage" as const,
							inputTokens,
							outputTokens,
							totalTokens: inputTokens + outputTokens,
							contextWindow,
						},
					},
				];
			}
			return null;
		}

		case "control_request":
			return processControlRequest(
				json as ClaudeControlRequestMessage,
				timestamp,
				pendingTools,
			);

		case "control_response":
			return processControlResponse(
				json as ClaudeControlResponseMessage,
				timestamp,
				pendingTools,
				completedPlanTools,
			);

		default:
			return null;
	}
}

/**
 * Process assistant message content items.
 */
function processAssistantMessage(
	json: ClaudeAssistantMessage,
	timestamp: string,
	pendingTools: Map<string, ConversationEntry>,
	completedPlanTools: Map<string, ConversationEntry>,
): ConversationEntry[] {
	// Skip subagent messages (these have a parent_tool_use_id)
	if (json.parent_tool_use_id) {
		return [];
	}

	const entries: ConversationEntry[] = [];

	for (const item of json.message.content) {
		switch (item.type) {
			case "text": {
				const trimmedText = item.text.trim();
				if (trimmedText) {
					entries.push({
						id: generateStableId("assistant", timestamp, trimmedText),
						timestamp,
						type: {
							kind: "assistant_message",
							text: trimmedText,
						},
					});
				}
				break;
			}

			case "thinking": {
				const trimmedThinking = item.thinking.trim();
				if (trimmedThinking) {
					entries.push({
						id: generateStableId("thinking", timestamp, trimmedThinking),
						timestamp,
						type: {
							kind: "thinking",
							thinking: trimmedThinking,
						},
					});
				}
				break;
			}

			case "tool_use": {
				// Create tool entry with 'running' status
				// Use Claude's tool ID for stable identification
				const action = mapToolNameToAction(item.name, item.input);
				const toolEntry: ConversationEntry = {
					id: generateToolId(item.id),
					timestamp,
					type: {
						kind: "tool",
						toolId: item.id,
						toolName: item.name,
						status: "running" as ToolStatus,
						action,
					},
				};
				entries.push(toolEntry);
				pendingTools.set(item.id, toolEntry);

				// Track ExitPlanMode tools for plan status detection
				if (item.name === "ExitPlanMode") {
					completedPlanTools.set(item.id, toolEntry);
				}
				break;
			}
		}
	}

	return entries;
}

/**
 * Process user message.
 * User messages can contain:
 * - text: User's typed input
 * - tool_result: Results from tool executions
 */
function processUserMessage(
	json: ClaudeUserMessage,
	timestamp: string,
	pendingTools: Map<string, ConversationEntry>,
	completedPlanTools: Map<string, ConversationEntry>,
): ConversationEntry[] {
	// Skip replay messages (these are replayed history from resumed sessions)
	// Note: is_synthetic is NOT filtered because in protocol mode, all user
	// messages sent via stdin are marked synthetic by Claude Code, including
	// the actual user-typed messages we want to display.
	if (json.is_replay) {
		return [];
	}

	// Skip subagent messages (these have a parent_tool_use_id)
	if (json.parent_tool_use_id) {
		return [];
	}

	const content = json.message.content;
	const entries: ConversationEntry[] = [];

	// Helper to check for plan approval/rejection and update plan status
	const checkAndUpdatePlanStatus = (text: string) => {
		const planStatus = determinePlanStatusFromText(text);
		if (!planStatus) return;

		for (const [toolId, entry] of completedPlanTools) {
			if (entry.type.kind === "tool") {
				const toolType = entry.type as ToolEntryType;
				if (toolType.action.type === "plan" && !toolType.action.planStatus) {
					(toolType.action as PlanAction).planStatus = planStatus;
					completedPlanTools.delete(toolId);
					break;
				}
			}
		}
	};

	if (typeof content === "string") {
		// Simple string content
		const trimmedContent = content.trim();
		if (trimmedContent) {
			// Check for plan approval/rejection
			checkAndUpdatePlanStatus(trimmedContent);

			entries.push({
				id: generateStableId("user", timestamp, trimmedContent),
				timestamp,
				type: {
					kind: "user_message",
					text: trimmedContent,
				},
				messageUuid: json.uuid,
			});
		}
	} else {
		// Array of content items - can include text and tool_result
		for (const item of content as ClaudeContentItem[]) {
			if (item.type === "text") {
				const trimmedText = item.text.trim();
				if (trimmedText) {
					// Check for plan approval/rejection
					checkAndUpdatePlanStatus(trimmedText);

					entries.push({
						id: generateStableId("user", timestamp, trimmedText),
						timestamp,
						type: {
							kind: "user_message",
							text: trimmedText,
						},
					});
				}
			} else if (item.type === "tool_result") {
				// Update the corresponding tool entry with result
				const toolEntry = pendingTools.get(item.tool_use_id);
				if (toolEntry && toolEntry.type.kind === "tool") {
					const toolType = toolEntry.type as ToolEntryType;
					toolType.status = applyToolResult(item.is_error ?? false);
					const output = formatToolOutput(item.content);
					toolType.result = {
						output,
						isError: item.is_error ?? false,
						...(toolType.toolName === "Bash"
							? { exitCode: extractExitCode(output, item.is_error) }
							: {}),
					};
					pendingTools.delete(item.tool_use_id);
				}
				// tool_result is not added as a separate entry (integrated into toolEntry)
			}
		}
	}

	return entries;
}

/**
 * Process control_request messages (permission requests).
 * Updates the corresponding tool entry's status to 'pending_approval'.
 */
function processControlRequest(
	json: ClaudeControlRequestMessage,
	_timestamp: string,
	pendingTools: Map<string, ConversationEntry>,
): ConversationEntry[] | null {
	const subtype = json.request.subtype;
	if (!applyControlRequest(subtype)) return null;

	const toolUseId = json.request.tool_use_id as string | undefined;
	if (!toolUseId) return null;

	const toolEntry = pendingTools.get(toolUseId);
	if (toolEntry && toolEntry.type.kind === "tool") {
		const toolType = toolEntry.type as ToolEntryType;
		toolType.status = "pending_approval";
		toolType.permissionRequestId = json.request_id;
	}

	return null;
}

/**
 * Process control_response messages (permission responses).
 * Updates the corresponding tool entry's status based on approval/denial.
 */
function processControlResponse(
	json: ClaudeControlResponseMessage,
	timestamp: string,
	pendingTools: Map<string, ConversationEntry>,
	completedPlanTools?: Map<string, ConversationEntry>,
): ConversationEntry[] | null {
	// Normalize legacy/new response formats
	const normalized = normalizeControlResponse(
		json.response as ControlResponseInput,
	);
	if (!normalized) return null;

	// Find the tool entry that matches this permission response
	for (const [, entry] of pendingTools) {
		if (entry.type.kind === "tool") {
			const toolType = entry.type as ToolEntryType;
			if (toolType.status === "pending_approval") {
				const transition = applyControlResponse(
					normalized.approved,
					normalized.reason,
					toolType.toolName,
					toolType.action.type,
				);

				toolType.status = transition.newStatus;

				if (transition.planStatusUpdate) {
					(toolType.action as PlanAction).planStatus =
						transition.planStatusUpdate;
					completedPlanTools?.delete(toolType.toolId);
				}

				if (transition.newStatus === "denied") {
					pendingTools.delete(toolType.toolId);

					if (transition.feedbackReason) {
						return [
							{
								id: generateStableId(
									"user_feedback",
									timestamp,
									transition.feedbackReason,
								),
								timestamp,
								type: {
									kind: "user_feedback",
									toolName: toolType.toolName,
									reason: transition.feedbackReason,
								},
							},
						];
					}
				}
				break;
			}
		}
	}

	return null;
}

/**
 * Find pending (interrupted) tool uses from raw logs.
 * These are tool_use calls that don't have corresponding tool_result.
 * Used for recovery when resuming interrupted sessions.
 */
export function findPendingToolUses(rawLogs: string): PendingToolUse[] {
	const lines = rawLogs.split(TIMESTAMP_PATTERN).filter(Boolean);

	// Track tool_use -> tool_result mapping
	const pendingTools = new Map<string, PendingToolUse>();

	for (const line of lines) {
		const parsed = parseLogLine(line);
		if (!parsed || parsed.source !== "stdout") continue;

		try {
			const json = JSON.parse(parsed.data) as ClaudeJsonMessage;

			if (json.type === "assistant") {
				const assistantMsg = json as ClaudeAssistantMessage;
				// Skip subagent messages
				if (assistantMsg.parent_tool_use_id) continue;

				for (const item of assistantMsg.message.content) {
					if (item.type === "tool_use") {
						pendingTools.set(item.id, {
							toolId: item.id,
							toolName: item.name,
							input: item.input,
						});
					}
				}
			} else if (json.type === "user") {
				const userMsg = json as ClaudeUserMessage;
				// Skip subagent and replay messages
				if (
					userMsg.parent_tool_use_id ||
					userMsg.is_replay
				)
					continue;

				const content = userMsg.message.content;
				if (Array.isArray(content)) {
					for (const item of content as ClaudeContentItem[]) {
						if (item.type === "tool_result") {
							// Mark this tool as completed
							pendingTools.delete(item.tool_use_id);
						}
					}
				}
			}
		} catch {
			// Skip non-JSON lines
		}
	}

	return Array.from(pendingTools.values());
}

/**
 * Find pending Task tool uses that were interrupted.
 * These need synthetic tool_results when resuming to avoid getting stuck.
 */
export function findInterruptedTaskTools(rawLogs: string): PendingToolUse[] {
	const pendingTools = findPendingToolUses(rawLogs);
	// Filter to only Task tools
	return pendingTools.filter((tool) => tool.toolName === "Task");
}
