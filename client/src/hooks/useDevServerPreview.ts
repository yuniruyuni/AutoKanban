import { useCallback, useEffect, useState } from "react";
import type { PreviewUrlInfo } from "@/lib/detect-preview-url";
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

/**
 * Build the proxy URL the iframe should load. The server reserves a port
 * (`DevServerProcess.proxyPort`) per dev-server process and runs a
 * pass-through proxy on it. The viewer hits that port on the same host
 * they're already viewing AutoKanban from — so regardless of where the
 * project's own dev server is actually listening (loopback, LAN, remote),
 * the browser only ever needs reachability to AutoKanban itself.
 */
function buildProxyUrl(proxyPort: number): PreviewUrlInfo {
	const { protocol, hostname } = window.location;
	const scheme = protocol === "https:" ? "https" : "http";
	const url = `${scheme}://${hostname}:${proxyPort}/`;
	return { url, port: proxyPort, scheme };
}

export function useDevServerPreview(
	options: UseDevServerPreviewOptions,
): UseDevServerPreviewResult {
	const { taskId, sessionId, projectHasDevServer } = options;
	const [status, setStatus] = useState<
		"idle" | "starting" | "searching" | "ready" | "error"
	>("idle");
	const [devServerEpId, setDevServerEpId] = useState<string | null>(null);
	const [proxyPort, setProxyPort] = useState<number | null>(null);

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
			setProxyPort(ep.proxyPort);
			// As soon as we know a proxy port we can flip to "ready" — the
			// iframe will show the proxy's warming-up page until the dev
			// server's real output kicks in (that's the proxy's problem,
			// not ours). No client-side URL detection is needed any more.
			if (status === "idle" || status === "starting") {
				setStatus("ready");
			}
		}
	}, [devServerData, status]);

	// Subscribe to dev server logs via SSE (shown under the Logs tab)
	const { logs, isStreaming } = useLogStream({
		executionProcessId: devServerEpId,
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
					// proxy port will arrive via `devServer.get` refetch (triggered
					// by the `status === "starting"` interval). Flip to searching
					// meanwhile so the UI doesn't keep the "starting" spinner.
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
		setProxyPort(null);
		setStatus("idle");
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

	const urls = proxyPort != null ? [buildProxyUrl(proxyPort)] : [];

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
