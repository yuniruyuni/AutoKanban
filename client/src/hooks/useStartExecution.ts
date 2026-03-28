import { trpc } from "@/trpc";

export interface StartExecutionParams {
	taskId: string;
	executor: string;
	variant?: string;
	targetBranch: string;
	dangerouslySkipPermissions?: boolean;
}

export interface StartExecutionResult {
	workspaceId: string;
	sessionId: string;
	executionProcessId: string;
	worktreePath: string;
}

export function useStartExecution() {
	const utils = trpc.useUtils();

	const mutation = trpc.execution.start.useMutation({
		onSuccess: () => {
			utils.task.list.invalidate();
		},
	});

	return {
		startExecution: async (
			params: StartExecutionParams,
		): Promise<StartExecutionResult> => {
			const result = await mutation.mutateAsync({
				taskId: params.taskId,
				executor: params.executor,
				variant: params.variant,
				targetBranch: params.targetBranch,
				dangerouslySkipPermissions: params.dangerouslySkipPermissions ?? true, // Default to true for headless execution
			});
			return result;
		},
		isStarting: mutation.isPending,
	};
}
