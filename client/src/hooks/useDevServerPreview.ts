import { useCallback, useEffect, useRef, useState } from "react";
import {
	type PreviewUrlInfo,
	detectPreviewUrl,
} from "@/lib/detect-preview-url";
import { trpc } from "@/trpc";
import { type LogEntry, useLogStream } from "./useLogStream";

export interface UseDevServerPreviewOptions {
	taskId: string;
	sessionId: string | null;
	projectHasDevServer: boolean;
}

export interface UseDevServerPreviewResult {
	urls: PreviewUrlInfo[];
	status: "idle" | "starting" | "searching" | "ready" | "error";
	executionProcessId: string | null;
	/** Whether the project has a dev server script configured */
	canStart: boolean;
	/** Whether the dev server is running (starting/searching/ready) */
	isRunning: boolean;
	/** Dev server process logs */
	logs: LogEntry[];
	/** Whether logs are being streamed */
	isStreaming: boolean;
	start: () => void;
	stop: () => void;
}

export function useDevServerPreview(
	options: UseDevServerPreviewOptions,
): UseDevServerPreviewResult {
	const { taskId, sessionId, projectHasDevServer } = options;
	const [urls, setUrls] = useState<PreviewUrlInfo[]>([]);
	const [status, setStatus] = useState<
		"idle" | "starting" | "searching" | "ready" | "error"
	>("idle");
	const [devServerEpId, setDevServerEpId] = useState<string | null>(null);
	const seenPorts = useRef(new Set<string>());

	const enabled = projectHasDevServer && !!sessionId;

	// Query existing dev server for this session (to restore state on page reload)
	const { data: devServerData } = trpc.devServer.get.useQuery(
		{ sessionId: sessionId ?? "" },
		{
			enabled,
			staleTime: 5000,
			refetchInterval: status === "starting" ? 2000 : false,
		},
	);

	const startMutation = trpc.devServer.start.useMutation();
	const stopMutation = trpc.devServer.stop.useMutation();

	// Restore running dev server state from server (e.g., after page reload)
	useEffect(() => {
		if (!devServerData?.executionProcess) return;
		const ep = devServerData.executionProcess;
		if (ep.status === "running") {
			setDevServerEpId(ep.id);
			if (status === "idle") {
				setStatus("searching");
			}
		}
	}, [devServerData, status]);

	// Handle log entries to detect URLs
	const onLog = useCallback(
		(entry: { data: string }) => {
			const info = detectPreviewUrl(entry.data);
			if (!info) return;

			// Deduplicate by port (or full URL if no port)
			const key = info.port ? String(info.port) : info.url;
			if (seenPorts.current.has(key)) return;
			seenPorts.current.add(key);

			setUrls((prev) => [...prev, info]);
			setStatus("ready");
		},
		[],
	);

	// Subscribe to dev server logs via SSE
	const { logs, isStreaming } = useLogStream({
		executionProcessId: devServerEpId,
		onLog,
	});

	// Start handler
	const start = useCallback(() => {
		if (!enabled) return;
		if (status !== "idle" && status !== "error") return;

		setStatus("starting");
		startMutation.mutate(
			{ taskId },
			{
				onSuccess: (result) => {
					setDevServerEpId(result.executionProcessId);
					setStatus("searching");
				},
				onError: () => {
					setStatus("error");
				},
			},
		);
	}, [enabled, status, taskId, startMutation]);

	// Stop handler
	const stop = useCallback(() => {
		if (!devServerEpId) return;
		stopMutation.mutate({ executionProcessId: devServerEpId });
		setDevServerEpId(null);
		setStatus("idle");
		setUrls([]);
		seenPorts.current.clear();
	}, [devServerEpId, stopMutation]);

	const isRunning =
		status === "starting" || status === "searching" || status === "ready";

	if (!enabled) {
		return {
			urls: [],
			status: "idle",
			executionProcessId: null,
			canStart: false,
			isRunning: false,
			logs: [],
			isStreaming: false,
			start: () => {},
			stop: () => {},
		};
	}

	return {
		urls,
		status,
		executionProcessId: devServerEpId,
		canStart: enabled,
		isRunning,
		logs,
		isStreaming,
		start,
		stop,
	};
}
