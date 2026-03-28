import { trpc } from "@/trpc";

export function useFileDiff(
	workspaceId: string | null,
	projectId: string | null,
	filePath: string | null,
) {
	const query = trpc.git.getFileDiff.useQuery(
		{
			workspaceId: workspaceId ?? "",
			projectId: projectId ?? "",
			filePath: filePath ?? "",
		},
		{ enabled: !!workspaceId && !!projectId && !!filePath },
	);

	return {
		diff: query.data ?? "",
		isLoading: query.isLoading,
		error: query.error ?? null,
		refetch: query.refetch,
	};
}
