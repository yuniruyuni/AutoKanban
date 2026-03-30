/**
 * Tool Result Formatter
 *
 * Pure functions for formatting tool execution results.
 * Extracted from conversation-parser.ts for independent testability.
 */

/**
 * Extract exit code from Bash tool output.
 * Tries to parse "Exit code: N" from output, falls back to is_error flag.
 */
export function extractExitCode(output: string, isError?: boolean): number {
	const match = output.match(/(?:^|\n)\s*Exit code:\s*(\d+)\s*$/);
	if (match) {
		return parseInt(match[1], 10);
	}
	return isError ? 1 : 0;
}

/**
 * Format tool output for display.
 */
export function formatToolOutput(content: unknown): string {
	if (typeof content === "string") {
		return content;
	}

	if (content === null || content === undefined) {
		return "";
	}

	try {
		return JSON.stringify(content, null, 2);
	} catch {
		return String(content);
	}
}
