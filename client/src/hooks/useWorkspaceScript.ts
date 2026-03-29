import { useCallback, useEffect, useRef, useState } from "react";
import { useLogStream } from "@/hooks/useLogStream";
import { trpc } from "@/trpc";

export function useWorkspaceScript(taskId: string) {
	const [executionProcessId, setExecutionProcessId] = useState<string | null>(
		null,
	);
	const [isRunning, setIsRunning] = useState(false);
	const [lastScriptType, setLastScriptType] = useState<
		"prepare" | "cleanup" | null
	>(null);
	const wasStreamingRef = useRef(false);

	const { logs, isStreaming } = useLogStream({
		executionProcessId,
	});

	const runPrepare = trpc.execution.runPrepare.useMutation({
		onSuccess: (data) => {
			setExecutionProcessId(data.executionProcessId);
			setIsRunning(true);
			setLastScriptType("prepare");
		},
	});

	const runCleanup = trpc.execution.runCleanup.useMutation({
		onSuccess: (data) => {
			setExecutionProcessId(data.executionProcessId);
			setIsRunning(true);
			setLastScriptType("cleanup");
		},
	});

	// Detect completion: streaming was active and then stopped
	useEffect(() => {
		if (isStreaming) {
			wasStreamingRef.current = true;
		} else if (wasStreamingRef.current && isRunning) {
			setIsRunning(false);
			wasStreamingRef.current = false;
		}
	}, [isStreaming, isRunning]);

	const handleRunPrepare = useCallback(() => {
		runPrepare.mutate({ taskId });
	}, [runPrepare, taskId]);

	const handleRunCleanup = useCallback(() => {
		runCleanup.mutate({ taskId });
	}, [runCleanup, taskId]);

	return {
		logs,
		isStreaming,
		isRunning: isRunning || runPrepare.isPending || runCleanup.isPending,
		lastScriptType,
		runPrepare: handleRunPrepare,
		runCleanup: handleRunCleanup,
		error: runPrepare.error || runCleanup.error,
	};
}
