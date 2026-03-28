import { trpc } from "@/trpc";

export function useGitMutations() {
	const utils = trpc.useUtils();

	const rebase = trpc.git.rebase.useMutation({
		onSuccess: () => {
			utils.git.getBranchStatus.invalidate();
			utils.git.getDiffs.invalidate();
		},
	});

	const abortRebase = trpc.git.abortRebase.useMutation({
		onSuccess: () => {
			utils.git.getBranchStatus.invalidate();
		},
	});

	const continueRebase = trpc.git.continueRebase.useMutation({
		onSuccess: () => {
			utils.git.getBranchStatus.invalidate();
			utils.git.getDiffs.invalidate();
		},
	});

	const merge = trpc.git.merge.useMutation({
		onSuccess: () => {
			utils.git.getBranchStatus.invalidate();
			utils.git.getDiffs.invalidate();
			utils.task.list.invalidate();
			utils.task.get.invalidate();
		},
	});

	const createPR = trpc.git.createPR.useMutation({
		onSuccess: () => {
			utils.git.getBranchStatus.invalidate();
			utils.git.getDiffs.invalidate();
		},
	});

	const finalizePrMerge = trpc.git.finalizePrMerge.useMutation({
		onSuccess: () => {
			utils.git.getBranchStatus.invalidate();
			utils.task.list.invalidate();
			utils.task.get.invalidate();
		},
	});

	return {
		rebase: async (
			workspaceId: string,
			projectId: string,
			newBaseBranch: string,
		) => {
			return rebase.mutateAsync({ workspaceId, projectId, newBaseBranch });
		},
		isRebasing: rebase.isPending,

		abortRebase: async (workspaceId: string, projectId: string) => {
			await abortRebase.mutateAsync({ workspaceId, projectId });
		},
		isAbortingRebase: abortRebase.isPending,

		continueRebase: async (workspaceId: string, projectId: string) => {
			return continueRebase.mutateAsync({ workspaceId, projectId });
		},
		isContinuingRebase: continueRebase.isPending,

		merge: async (
			workspaceId: string,
			projectId: string,
			targetBranch: string,
		) => {
			return merge.mutateAsync({
				workspaceId,
				projectId,
				targetBranch,
			});
		},
		isMerging: merge.isPending,

		createPR: async (
			workspaceId: string,
			projectId: string,
			taskTitle: string,
			draft?: boolean,
		) => {
			return createPR.mutateAsync({ workspaceId, projectId, taskTitle, draft });
		},
		isCreatingPR: createPR.isPending,

		finalizePrMerge: async (workspaceId: string, projectId: string) => {
			return finalizePrMerge.mutateAsync({ workspaceId, projectId });
		},
		isFinalizingPrMerge: finalizePrMerge.isPending,
	};
}
