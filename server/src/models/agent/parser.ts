import type { ParseResult } from "../conversation/conversation-parser";

export interface AgentLogParser {
	parse(rawLogs: string): ParseResult;
}
