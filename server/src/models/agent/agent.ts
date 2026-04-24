import type { AgentLogParser } from "./parser";

export type AgentId = "claude-code" | "gemini-cli" | "codex-cli" | string;

export type AgentCapability =
	| "protocolSession"
	| "oneShot"
	| "resume"
	| "streamJsonLogs"
	| "approvalRequest"
	| "mcpConfig"
	| "structuredOutput";

export interface AgentVariantSeed {
	executor: AgentId;
	name: string;
	permissionMode: string;
	model?: string | null;
	appendPrompt?: string | null;
}

export interface CodingAgent {
	id: AgentId;
	displayName: string;
	defaultCommand: string;
	installHint: string;
	capabilities: readonly AgentCapability[];
	defaultVariants: readonly AgentVariantSeed[];
	createParser(): AgentLogParser;
}
