/**
 * Info needed to resume a Claude Code session
 */
export interface CodingAgentResumeInfo {
	agentSessionId: string;
	agentMessageId: string | null;
}
