import { trpc } from "@/trpc";

export function useConversationFork(sessionId?: string | null) {
	const forkMutation = trpc.execution.forkConversation.useMutation();

	const fork = async (messageUuid: string, newPrompt: string) => {
		if (!sessionId) return;
		return await forkMutation.mutateAsync({
			sessionId,
			messageUuid,
			newPrompt,
		});
	};

	return {
		fork,
		isForking: forkMutation.isPending,
	};
}
