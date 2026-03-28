import { trpc } from "@/trpc";

export function useAttempts(taskId: string) {
	const { data, isLoading } = trpc.workspace.listAttempts.useQuery(
		{ taskId },
		{ staleTime: 5000, refetchInterval: 10000 },
	);

	return {
		attempts: data?.attempts ?? [],
		activeAttempt: data?.activeAttempt ?? null,
		isLoading,
	};
}
