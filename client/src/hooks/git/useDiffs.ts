import { trpc } from "@/trpc";

export interface GitDiff {
	filePath: string;
	status: "added" | "modified" | "deleted" | "renamed";
	oldPath?: string;
	additions: number;
	deletions: number;
}

export function useDiffs(workspaceId: string | null, projectId: string | null) {
	const query = trpc.git.getDiffs.useQuery(
		{ workspaceId: workspaceId ?? "", projectId: projectId ?? "" },
		{ enabled: !!workspaceId && !!projectId, refetchInterval: 5000 },
	);

	return {
		diffs: (query.data?.diffs as GitDiff[]) ?? [],
		totalAdditions: query.data?.totalAdditions ?? 0,
		totalDeletions: query.data?.totalDeletions ?? 0,
		isLoading: query.isLoading,
		error: query.error ?? null,
		refetch: query.refetch,
	};
}
