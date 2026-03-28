import { trpc } from "../trpc";

export interface StartExecutionParams {
	taskId: string;
	prompt: string;
	workingDir: string;
	executor?: string;
	dangerouslySkipPermissions?: boolean;
	model?: string;
}

export function useExecution() {
	const startMutation = trpc.execution.start.useMutation({
		onSuccess: () => {
			// Invalidate related queries if needed
		},
	});

	const stopMutation = trpc.execution.stop.useMutation({
		onSuccess: () => {
			// Invalidate related queries if needed
		},
	});

	const start = async (params: StartExecutionParams) => {
		return startMutation.mutateAsync(params);
	};

	const stop = async (executionProcessId: string) => {
		return stopMutation.mutateAsync({ executionProcessId });
	};

	return {
		start,
		stop,
		isStarting: startMutation.isPending,
		isStopping: stopMutation.isPending,
		startError: startMutation.error,
		stopError: stopMutation.error,
	};
}

export function useExecutionStatus(executionProcessId: string | null) {
	const query = trpc.execution.get.useQuery(
		{ executionProcessId: executionProcessId ?? "", includeLogs: false },
		{
			enabled: !!executionProcessId,
			refetchInterval: (data) => {
				const status = data?.state?.data?.executionProcess.status;
				// Stop polling only when execution is truly complete
				if (
					status === "completed" ||
					status === "failed" ||
					status === "killed"
				) {
					return false;
				}
				return 2000; // Poll every 2 seconds while active
			},
		},
	);

	return {
		executionProcess: query.data?.executionProcess ?? null,
		isLoading: query.isLoading,
		error: query.error,
		refetch: query.refetch,
	};
}
