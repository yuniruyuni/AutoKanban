import { trpc } from "@/trpc";

export function usePermissionResponse(sessionId?: string | null) {
	const respondMutation = trpc.execution.respondToPermission.useMutation();

	const approve = async (requestId: string) => {
		if (!sessionId) return;
		await respondMutation.mutateAsync({
			sessionId,
			requestId,
			approved: true,
		});
	};

	const deny = async (requestId: string, reason?: string) => {
		if (!sessionId) return;
		await respondMutation.mutateAsync({
			sessionId,
			requestId,
			approved: false,
			reason,
		});
	};

	return {
		approve,
		deny,
		isLoading: respondMutation.isPending,
	};
}
