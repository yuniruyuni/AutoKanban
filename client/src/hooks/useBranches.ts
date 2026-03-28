import { trpc } from "@/trpc";

export interface Branch {
	name: string;
	isCurrent: boolean;
}

export function useBranches(projectId: string | null) {
	const query = trpc.git.listBranches.useQuery(
		{ projectId: projectId ?? "" },
		{ enabled: !!projectId },
	);

	return {
		branches: (query.data?.branches as Branch[]) ?? [],
		isLoading: query.isLoading,
		error: query.error ?? null,
		refetch: query.refetch,
	};
}
