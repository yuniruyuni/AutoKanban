import { trpc } from "@/trpc";

/**
 * Hook for responding to approvals (plan or permission) via the ApprovalStore.
 */
export function useApprovalMutation() {
	const mutation = trpc.approval.respond.useMutation();

	const approve = async (approvalId: string, executionProcessId: string) => {
		await mutation.mutateAsync({
			approvalId,
			executionProcessId,
			status: "approved",
		});
	};

	const deny = async (
		approvalId: string,
		executionProcessId: string,
		reason?: string,
	) => {
		await mutation.mutateAsync({
			approvalId,
			executionProcessId,
			status: "denied",
			reason: reason ?? null,
		});
	};

	return {
		approve,
		deny,
		isPending: mutation.isPending,
		error: mutation.error,
	};
}
