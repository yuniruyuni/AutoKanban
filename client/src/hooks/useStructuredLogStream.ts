import { useCallback, useEffect, useRef, useState } from "react";
import type { ConversationEntry } from "@/components/chat/types";

interface UseStructuredLogStreamResult {
	entries: ConversationEntry[];
	isIdle: boolean;
	isConnected: boolean;
}

/**
 * Hook that connects to the structured log SSE endpoint.
 * Falls back to polling via tRPC if SSE connection fails.
 */
export function useStructuredLogStream(
	executionProcessId: string | null,
	isRunning: boolean,
): UseStructuredLogStreamResult {
	const [entries, setEntries] = useState<ConversationEntry[]>([]);
	const [isIdle, setIsIdle] = useState(false);
	const [isConnected, setIsConnected] = useState(false);
	const entriesRef = useRef<Map<string, ConversationEntry>>(new Map());
	const eventSourceRef = useRef<EventSource | null>(null);

	const updateEntries = useCallback(() => {
		const sorted = Array.from(entriesRef.current.values());
		setEntries(sorted);
	}, []);

	useEffect(() => {
		if (!executionProcessId || !isRunning) {
			return;
		}

		const baseUrl = import.meta.env.VITE_API_URL ?? "";
		const url = `${baseUrl}/sse/structured-logs/${executionProcessId}`;

		const es = new EventSource(url);
		eventSourceRef.current = es;

		es.addEventListener("snapshot", (event) => {
			const data = JSON.parse(event.data) as {
				entries: ConversationEntry[];
				isIdle: boolean;
			};
			entriesRef.current.clear();
			for (const entry of data.entries) {
				entriesRef.current.set(entry.id, entry);
			}
			setIsIdle(data.isIdle);
			updateEntries();
		});

		es.addEventListener("entry_add", (event) => {
			const entry = JSON.parse(event.data) as ConversationEntry;
			entriesRef.current.set(entry.id, entry);
			updateEntries();
		});

		es.addEventListener("entry_update", (event) => {
			const entry = JSON.parse(event.data) as ConversationEntry;
			entriesRef.current.set(entry.id, entry);
			updateEntries();
		});

		es.addEventListener("idle_changed", (event) => {
			const data = JSON.parse(event.data) as { isIdle: boolean };
			setIsIdle(data.isIdle);
		});

		es.onopen = () => {
			setIsConnected(true);
		};

		es.onerror = () => {
			setIsConnected(false);
		};

		return () => {
			es.close();
			eventSourceRef.current = null;
			setIsConnected(false);
		};
	}, [executionProcessId, isRunning, updateEntries]);

	return { entries, isIdle, isConnected };
}
