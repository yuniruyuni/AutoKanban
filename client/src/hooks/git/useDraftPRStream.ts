import { useEffect, useRef, useState } from "react";

type DraftPRStatus = "generating" | "completed" | "failed" | null;

export function useDraftPRStream(
	workspaceId: string | null,
	projectId: string | null,
) {
	const [status, setStatus] = useState<DraftPRStatus>(null);
	const [title, setTitle] = useState<string | null>(null);
	const [body, setBody] = useState<string | null>(null);
	const [logs, setLogs] = useState("");
	const [isConnected, setIsConnected] = useState(false);
	const eventSourceRef = useRef<EventSource | null>(null);

	useEffect(() => {
		if (!workspaceId || !projectId) {
			return;
		}

		// Close existing connection
		if (eventSourceRef.current) {
			eventSourceRef.current.close();
		}

		// Reset state
		setStatus(null);
		setTitle(null);
		setBody(null);
		setLogs("");

		const baseUrl = import.meta.env.VITE_API_URL || "http://localhost:3000";
		const url = `${baseUrl}/sse/draft-pr/${workspaceId}/${projectId}`;

		const es = new EventSource(url);
		eventSourceRef.current = es;

		es.addEventListener("snapshot", (event) => {
			const data = JSON.parse(event.data) as {
				status: DraftPRStatus;
				title: string | null;
				body: string | null;
				logs: string;
			};
			setStatus(data.status);
			setTitle(data.title);
			setBody(data.body);
			setLogs(data.logs);
		});

		es.addEventListener("log", (event) => {
			const data = JSON.parse(event.data) as { data: string };
			setLogs((prev) => prev + data.data);
		});

		es.addEventListener("status_changed", (event) => {
			const data = JSON.parse(event.data) as {
				status: DraftPRStatus;
				title: string | null;
				body: string | null;
			};
			setStatus(data.status);
			if (data.title != null) setTitle(data.title);
			if (data.body != null) setBody(data.body);
			if (data.status === "completed" || data.status === "failed") {
				es.close();
				eventSourceRef.current = null;
				setIsConnected(false);
			}
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
	}, [workspaceId, projectId]);

	return { status, title, body, logs, isConnected };
}
