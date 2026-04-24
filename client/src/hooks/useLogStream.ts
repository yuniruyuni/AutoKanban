import { useCallback, useEffect, useRef, useState } from "react";
import { parseDbLogs } from "@/lib/log-parser";
import { trpc } from "@/trpc";

export interface LogEntry {
	timestamp: string;
	source: "stdout" | "stderr";
	data: string;
}

export interface UseLogStreamOptions {
	executionProcessId: string | null;
	onLog?: (entry: LogEntry) => void;
}

export function useLogStream(options: UseLogStreamOptions) {
	const [logs, setLogs] = useState<LogEntry[]>([]);
	const [isStreaming, setIsStreaming] = useState(false);
	const [error, setError] = useState<Error | null>(null);
	const [shouldFetchDb, setShouldFetchDb] = useState(false);
	const eventSourceRef = useRef<EventSource | null>(null);

	const clearLogs = useCallback(() => {
		setLogs([]);
	}, []);

	// Fetch logs from database when SSE is not available
	const { data: dbData } = trpc.execution.get.useQuery(
		{ executionProcessId: options.executionProcessId ?? "", includeLogs: true },
		{
			enabled: shouldFetchDb && !!options.executionProcessId,
			staleTime: Infinity, // Don't refetch
		},
	);

	// Process database logs when loaded
	useEffect(() => {
		if (dbData?.logs?.logs) {
			const parsedLogs = parseDbLogs(dbData.logs.logs);
			if (parsedLogs.length > 0) {
				setLogs(parsedLogs);
			}
		}
	}, [dbData]);

	useEffect(() => {
		if (!options.executionProcessId) {
			return;
		}

		// Reset state for new execution
		setLogs([]);
		setShouldFetchDb(false);

		// Close existing connection
		if (eventSourceRef.current) {
			eventSourceRef.current.close();
		}

		const url = `/sse/logs/${options.executionProcessId}`;

		const eventSource = new EventSource(url);
		eventSourceRef.current = eventSource;
		setError(null);

		eventSource.onopen = () => {
			setIsStreaming(true);
		};

		// Listen for named "log" events from the SSE stream
		eventSource.addEventListener("log", (event) => {
			try {
				const raw: string = JSON.parse(event.data);
				const entries = parseDbLogs(raw);
				if (entries.length > 0) {
					setLogs((prev) => [...prev, ...entries]);
					for (const entry of entries) {
						options.onLog?.(entry);
					}
				}
			} catch (e) {
				console.error("Failed to parse log event:", e);
			}
		});

		// The server emits "done" once the underlying process has reached a
		// terminal status and all logs have drained. Close cleanly so
		// downstream hooks (e.g. useWorkspaceScript) can flip their
		// "isRunning" state off without guessing from connection errors.
		eventSource.addEventListener("done", () => {
			setIsStreaming(false);
			eventSource.close();
			eventSourceRef.current = null;
		});

		eventSource.onerror = () => {
			// Try loading from database on connection error
			console.log("[useLogStream] SSE error, loading from database");
			setShouldFetchDb(true);
			setIsStreaming(false);
			eventSource.close();
		};

		return () => {
			eventSource.close();
			eventSourceRef.current = null;
		};
	}, [options.executionProcessId, options.onLog]);

	return {
		logs,
		isStreaming,
		error,
		clearLogs,
	};
}
