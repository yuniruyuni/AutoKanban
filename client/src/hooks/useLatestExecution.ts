import { useEffect } from "react";
import { useSnapshot } from "valtio";
import { executionActions, executionStore } from "@/store";
import { trpc } from "@/trpc";

/**
 * Hook to load and restore the latest execution state for a task.
 * Polls periodically to detect new execution processes (e.g., from
 * server-side resume retries that create a new EP).
 */
export function useLatestExecution(taskId: string) {
	const executionState = useSnapshot(executionStore);
	const currentEp = executionState.activeExecutions[taskId];

	// Poll more frequently when current EP is in a terminal state
	// to quickly detect retry-created new EPs
	const isTerminal =
		currentEp?.status === "killed" ||
		currentEp?.status === "failed" ||
		currentEp?.status === "completed";

	const { data, isLoading, error } = trpc.execution.getLatest.useQuery(
		{ taskId, includeLogs: false },
		{
			staleTime: 3000,
			refetchInterval: isTerminal ? 3000 : 10000,
		},
	);

	// Restore execution state to UI store when data is loaded
	useEffect(() => {
		if (!data) return;

		if (data.sessionId && data.executionProcess) {
			executionActions.setExecutionInfo(taskId, {
				sessionId: data.sessionId,
				executionProcessId: data.executionProcess.id,
				status: data.executionProcess.status,
				workspaceId: data.workspaceId ?? undefined,
			});
		} else {
			executionActions.clearExecution(taskId);
		}
	}, [taskId, data]);

	return {
		workspaceId: data?.workspaceId ?? null,
		sessionId: data?.sessionId ?? null,
		executionProcess: data?.executionProcess ?? null,
		isLoading,
		error: error ?? null,
	};
}
