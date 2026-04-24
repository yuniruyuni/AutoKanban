import { parseLogsToConversation } from "../conversation/conversation-parser";
import type { CodingAgent } from "./agent";
import type { AgentLogParser } from "./parser";

class ClaudeCodeLogParser implements AgentLogParser {
	parse(rawLogs: string) {
		return parseLogsToConversation(rawLogs);
	}
}

export const claudeCodeAgent: CodingAgent = {
	id: "claude-code",
	displayName: "Claude Code",
	defaultCommand: "claude",
	installHint: "npm install -g @anthropic-ai/claude-code",
	capabilities: [
		"protocolSession",
		"approvalRequest",
		"mcpConfig",
		"structuredOutput",
	],
	defaultVariants: [
		{
			executor: "claude-code",
			name: "DEFAULT",
			permissionMode: "default",
		},
		{
			executor: "claude-code",
			name: "BYPASS",
			permissionMode: "bypassPermissions",
		},
		{
			executor: "claude-code",
			name: "PLAN",
			permissionMode: "plan",
		},
	],
	createParser: () => new ClaudeCodeLogParser(),
};
