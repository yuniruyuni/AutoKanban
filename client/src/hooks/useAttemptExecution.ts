import { trpc } from "@/trpc";

export function useAttemptExecution(workspaceId: string | null) {
	const { data } = trpc.workspace.getAttemptExecution.useQuery(
		{ workspaceId: workspaceId as string },
		{ enabled: !!workspaceId },
	);

	return {
		sessionId: data?.sessionId ?? null,
		executionProcessId: data?.executionProcessId ?? null,
	};
}
