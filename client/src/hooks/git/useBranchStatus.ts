import { trpc } from "@/trpc";

export interface BranchStatus {
	branch: string;
	targetBranch: string;
	isRebaseInProgress: boolean;
	isMergeInProgress: boolean;
	conflictOp: "rebase" | "merge" | "cherryPick" | "revert" | null;
	conflictedFiles: string[];
	ahead: number;
	behind: number;
	lastCommitHash: string | null;
	lastCommitMessage: string | null;
	prUrl: string | null;
	prState: "open" | "closed" | "merged" | null;
}

export function useBranchStatus(
	workspaceId: string | null,
	projectId: string | null,
) {
	const query = trpc.git.getBranchStatus.useQuery(
		{ workspaceId: workspaceId ?? "", projectId: projectId ?? "" },
		{ enabled: !!workspaceId && !!projectId, refetchInterval: 5000 },
	);

	return {
		status: (query.data as BranchStatus) ?? null,
		isLoading: query.isLoading,
		error: query.error ?? null,
		refetch: query.refetch,
	};
}
