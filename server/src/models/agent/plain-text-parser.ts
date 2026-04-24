import { createHash } from "node:crypto";
import type { ParseResult } from "../conversation/conversation-parser";
import type { ConversationEntry } from "../conversation/types";
import type { AgentLogParser } from "./parser";

const TIMESTAMP_PATTERN = /(?=\[\d{4}-\d{2}-\d{2}T[\d:.]+Z?\])/;
const LOG_LINE_PATTERN = /^\[([^\]]+)\]\s*\[([^\]]+)\]\s*(.*)$/s;

function stableId(prefix: string, timestamp: string, content: string): string {
	return `${prefix}-${createHash("sha256")
		.update(`${timestamp}:${content}`)
		.digest("hex")
		.substring(0, 16)}`;
}

export class PlainTextLogParser implements AgentLogParser {
	constructor(private readonly prefix: string) {}

	parse(rawLogs: string): ParseResult {
		const entries: ConversationEntry[] = [];
		for (const line of rawLogs.split(TIMESTAMP_PATTERN).filter(Boolean)) {
			const match = line.match(LOG_LINE_PATTERN);
			if (!match) continue;

			const [, timestamp, source, data] = match;
			const text = data.trim();
			if (!text) continue;

			entries.push({
				id: stableId(`${this.prefix}-${source}`, timestamp, text),
				timestamp,
				type:
					source === "stderr"
						? { kind: "error", message: text }
						: { kind: "assistant_message", text },
			});
		}

		return { entries, isIdle: false };
	}
}
