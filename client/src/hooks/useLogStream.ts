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
	onEnd?: () => void;
	onError?: (error: Error) => void;
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

		const baseUrl = import.meta.env.VITE_API_URL || "http://localhost:3000";
		const url = `${baseUrl}/sse/logs/${options.executionProcessId}`;

		const eventSource = new EventSource(url);
		eventSourceRef.current = eventSource;
		setIsStreaming(true);
		setError(null);

		eventSource.onmessage = (event) => {
			try {
				const data = JSON.parse(event.data);

				if (data.type === "end") {
					setIsStreaming(false);
					options.onEnd?.();
					eventSource.close();
					return;
				}

				if (data.type === "error") {
					// If process not found, try loading from database
					if (data.message === "Process not found") {
						console.log(
							"[useLogStream] Process not found, loading from database",
						);
						setShouldFetchDb(true);
					} else {
						setError(new Error(data.message));
					}
					setIsStreaming(false);
					options.onError?.(new Error(data.message));
					eventSource.close();
					return;
				}

				// Skip info messages (e.g., "Another stream is already active")
				if (data.type === "info") {
					console.log("[useLogStream] Info message:", data.message);
					return;
				}

				// Validate log entry structure - skip if invalid
				if (!data.timestamp || !data.source || data.data === undefined) {
					console.warn("[useLogStream] Invalid log entry structure:", data);
					return;
				}

				// Regular log entry
				const entry: LogEntry = {
					timestamp: data.timestamp,
					source: data.source,
					data: data.data,
				};

				setLogs((prev) => [...prev, entry]);
				options.onLog?.(entry);
			} catch (e) {
				console.error("Failed to parse log entry:", e);
			}
		};

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
	}, [
		options.executionProcessId,
		options.onEnd,
		options.onError,
		options.onLog,
	]);

	return {
		logs,
		isStreaming,
		error,
		clearLogs,
	};
}
