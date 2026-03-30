/**
 * Builds a context-restoring prompt from previous conversation logs.
 * Used when --resume fails and we need to start a fresh session
 * while preserving awareness of what was previously done.
 */

const TIMESTAMP_PATTERN = /\[\d{4}-\d{2}-\d{2}T[\d:.]+Z\] \[(stdout|stderr)\] /;

interface ContentBlock {
	type: string;
	text?: string;
}

/**
 * Extracts assistant messages and key tool actions from raw logs.
 * Returns a condensed context string.
 */
export function buildContextFromLogs(
	allLogs: string[],
	maxLength: number = 8000,
): string {
	const segments: string[] = [];

	for (const rawLogs of allLogs) {
		const lines = rawLogs.split(TIMESTAMP_PATTERN).filter(Boolean);

		for (const line of lines) {
			try {
				const json = JSON.parse(line.trim());

				// Extract assistant text messages
				if (json.type === "assistant" && json.message?.content) {
					const content = json.message.content as ContentBlock[];
					for (const block of content) {
						if (block.type === "text" && block.text) {
							segments.push(`[Assistant]: ${block.text}`);
						}
					}
				}

				// Extract user messages (not tool results)
				if (
					json.type === "user" &&
					json.message?.content &&
					!json.parent_tool_use_id
				) {
					const content = json.message.content;
					if (typeof content === "string") {
						segments.push(`[User]: ${content}`);
					} else if (Array.isArray(content)) {
						for (const block of content as ContentBlock[]) {
							if (block.type === "text" && block.text) {
								segments.push(`[User]: ${block.text}`);
							}
						}
					}
				}
			} catch {
				// Skip non-JSON lines
			}
		}
	}

	if (segments.length === 0) return "";

	// Truncate from the end (keep most recent context)
	let result = segments.join("\n\n");
	if (result.length > maxLength) {
		result = `...(earlier context truncated)...\n\n${result.slice(-maxLength)}`;
	}

	return result;
}

/**
 * Wraps user prompt with conversation context for a fresh restart.
 */
export function buildContextRestoredPrompt(
	originalPrompt: string,
	contextSummary: string,
): string {
	if (!contextSummary) return originalPrompt;

	return `[CONTEXT RESTORATION]
The previous Claude Code session was interrupted and could not be resumed.
Below is the conversation history from that session. Please continue from where it left off.

<previous_conversation>
${contextSummary}
</previous_conversation>

The user's latest message:
${originalPrompt}`;
}
