import type { LogEntry } from "@/hooks/useLogStream";

/**
 * Parse database log format into LogEntry array.
 * Database format: "[timestamp] [source] data\n..."
 */
export function parseDbLogs(logsText: string): LogEntry[] {
	const entries: LogEntry[] = [];
	const lines = logsText.split("\n");

	for (const line of lines) {
		if (!line.trim()) continue;

		// Parse format: [2024-01-01T12:00:00.000Z] [stdout] data
		const match = line.match(/^\[([^\]]+)\]\s*\[([^\]]+)\]\s*(.*)$/);
		if (match) {
			entries.push({
				timestamp: match[1],
				source: match[2] as "stdout" | "stderr",
				data: match[3],
			});
		}
	}

	return entries;
}
