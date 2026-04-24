import { createHash } from "node:crypto";
import type { ParseResult } from "../conversation/conversation-parser";
import type { ConversationEntry, ToolStatus } from "../conversation/types";
import type { CodingAgent } from "./agent";
import type { AgentLogParser } from "./parser";

const TIMESTAMP_PATTERN = /(?=\[\d{4}-\d{2}-\d{2}T[\d:.]+Z?\])/;
const LOG_LINE_PATTERN = /^\[([^\]]+)\]\s*\[([^\]]+)\]\s*(.*)$/s;

type CodexEvent = {
	id?: string;
	msg?: { type?: string; [key: string]: unknown };
	type?: string;
	[key: string]: unknown;
};

function stableId(prefix: string, timestamp: string, content: string): string {
	return `${prefix}-${createHash("sha256")
		.update(`${prefix}:${timestamp}:${content.substring(0, 500)}`)
		.digest("hex")
		.substring(0, 16)}`;
}

function textFrom(value: unknown): string | null {
	if (typeof value === "string") return value;
	if (!value || typeof value !== "object") return null;
	const obj = value as Record<string, unknown>;
	for (const key of [
		"text",
		"message",
		"content",
		"output",
		"summary",
		"final_response",
	]) {
		if (typeof obj[key] === "string") return obj[key] as string;
	}
	return null;
}

function stringifyPayload(payload: unknown): string {
	if (typeof payload === "string") return payload;
	try {
		return JSON.stringify(payload);
	} catch {
		return String(payload);
	}
}

export class CodexCliLogParser implements AgentLogParser {
	parse(rawLogs: string): ParseResult {
		const entries: ConversationEntry[] = [];
		const toolEntries = new Map<string, ConversationEntry>();

		for (const line of rawLogs.split(TIMESTAMP_PATTERN).filter(Boolean)) {
			const match = line.match(LOG_LINE_PATTERN);
			if (!match) continue;

			const [, timestamp, source, data] = match;
			const trimmed = data.trim();
			if (!trimmed) continue;

			if (source === "stderr") {
				entries.push({
					id: stableId("codex-error", timestamp, trimmed),
					timestamp,
					type: { kind: "error", message: trimmed },
				});
				continue;
			}

			let event: CodexEvent;
			try {
				event = JSON.parse(trimmed) as CodexEvent;
			} catch {
				entries.push({
					id: stableId("codex-text", timestamp, trimmed),
					timestamp,
					type: { kind: "assistant_message", text: trimmed },
				});
				continue;
			}

			const msg = event.msg ?? event;
			const type = msg.type ?? event.type;
			if (!type) continue;

			if (
				type === "agent_message" ||
				type === "message" ||
				type === "final_answer"
			) {
				const text = textFrom(msg);
				if (text?.trim()) {
					entries.push({
						id: stableId("codex-assistant", timestamp, text),
						timestamp,
						type: { kind: "assistant_message", text: text.trim() },
					});
				}
				continue;
			}

			if (type === "agent_reasoning") {
				const text = textFrom(msg);
				if (text?.trim()) {
					entries.push({
						id: stableId("codex-thinking", timestamp, text),
						timestamp,
						type: { kind: "thinking", thinking: text.trim() },
					});
				}
				continue;
			}

			if (type === "exec_command_begin" || type === "exec_approval_request") {
				const callId =
					typeof msg.call_id === "string"
						? msg.call_id
						: stableId("codex-tool", timestamp, trimmed);
				const command = Array.isArray(msg.command)
					? msg.command.map(String).join(" ")
					: typeof msg.command === "string"
						? msg.command
						: stringifyPayload(msg);
				const status: ToolStatus =
					type === "exec_approval_request" ? "pending_approval" : "running";
				const entry: ConversationEntry = {
					id: `tool-${callId}`,
					timestamp,
					type: {
						kind: "tool",
						toolId: callId,
						toolName: "exec",
						status,
						action: { type: "command", command },
						permissionRequestId:
							type === "exec_approval_request" ? callId : undefined,
					},
				};
				entries.push(entry);
				toolEntries.set(callId, entry);
				continue;
			}

			if (type === "exec_command_end" || type === "exec_command_output") {
				const callId = typeof msg.call_id === "string" ? msg.call_id : null;
				const entry = callId ? toolEntries.get(callId) : null;
				if (entry?.type.kind === "tool") {
					const exitCode =
						typeof msg.exit_code === "number" ? msg.exit_code : undefined;
					const output = textFrom(msg) ?? stringifyPayload(msg);
					entry.type.status =
						exitCode === undefined || exitCode === 0 ? "success" : "failed";
					entry.type.result = {
						output,
						isError: exitCode !== undefined && exitCode !== 0,
						...(exitCode !== undefined ? { exitCode } : {}),
					};
				}
				continue;
			}

			if (type === "error") {
				entries.push({
					id: stableId("codex-error", timestamp, trimmed),
					timestamp,
					type: {
						kind: "error",
						message: textFrom(msg) ?? stringifyPayload(msg),
					},
				});
				continue;
			}

			if (type === "token_count") {
				const info = msg.info as Record<string, unknown> | null | undefined;
				const inputTokens = Number(info?.input_tokens ?? 0);
				const outputTokens = Number(info?.output_tokens ?? 0);
				if (inputTokens || outputTokens) {
					entries.push({
						id: stableId(
							"codex-token",
							timestamp,
							`${inputTokens}:${outputTokens}`,
						),
						timestamp,
						type: {
							kind: "token_usage",
							inputTokens,
							outputTokens,
							totalTokens: inputTokens + outputTokens,
							contextWindow: Number(info?.context_window ?? 0),
						},
					});
				}
			}
		}

		return { entries, isIdle: false };
	}
}

export const codexCliAgent: CodingAgent = {
	id: "codex-cli",
	displayName: "Codex CLI",
	defaultCommand: "codex",
	installHint: "npm install -g @openai/codex",
	capabilities: ["oneShot", "resume", "streamJsonLogs", "mcpConfig"],
	defaultVariants: [
		{
			executor: "codex-cli",
			name: "DEFAULT",
			permissionMode: "full-auto",
		},
		{
			executor: "codex-cli",
			name: "READONLY",
			permissionMode: "read-only",
		},
		{
			executor: "codex-cli",
			name: "YOLO",
			permissionMode: "dangerously-bypass",
		},
	],
	createParser: () => new CodexCliLogParser(),
};
