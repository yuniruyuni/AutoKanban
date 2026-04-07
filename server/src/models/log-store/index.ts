export type LogSource = "stdout" | "stderr" | "stdin";

export interface LogEntry {
	timestamp: Date;
	source: LogSource;
	data: string;
}

export interface LogStoreSubscription {
	/**
	 * Async generator that yields all history first, then live updates.
	 */
	stream: AsyncGenerator<LogEntry, void, unknown>;
	/**
	 * Unsubscribe from live updates.
	 */
	unsubscribe: () => void;
}
