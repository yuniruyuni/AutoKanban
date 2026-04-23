import { skipToken } from "@tanstack/react-query";
import {
	AlertCircle,
	CheckCircle,
	ChevronDown,
	ExternalLink,
	RefreshCw,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { BranchCombobox } from "@/components/atoms/BranchCombobox";
import { Button } from "@/components/atoms/Button";
import { Dialog, DialogContent, DialogHeader } from "@/components/atoms/Dialog";
import { CreatePRDialog } from "@/components/task/CreatePRDialog";
import { useBranchStatus, useDiffs, useGitMutations } from "@/hooks/useGit";
import { cn } from "@/lib/utils";
import { trpc } from "@/trpc";

interface GitOperationButtonsProps {
	workspaceId: string | null;
	projectId: string | null;
	taskStatus?: string;
	taskTitle?: string;
	onConflict?: (files: string[]) => void;
}

export function GitOperationButtons({
	workspaceId,
	projectId,
	taskStatus,
	taskTitle,
	onConflict,
}: GitOperationButtonsProps) {
	const { status, refetch } = useBranchStatus(workspaceId, projectId);
	const { diffs } = useDiffs(workspaceId, projectId);
	const { data: branchData } = trpc.git.listBranches.useQuery(
		projectId ? { projectId } : skipToken,
	);
	const {
		rebase,
		isRebasing,
		abortRebase,
		isAbortingRebase,
		continueRebase,
		isContinuingRebase,
		resolveRebaseConflict,
		merge,
		isMerging,
		finalizePrMerge,
		isFinalizingPrMerge,
	} = useGitMutations();

	const [showRebaseDialog, setShowRebaseDialog] = useState(false);
	const [showMergeDialog, setShowMergeDialog] = useState(false);
	const [showCreatePRDialog, setShowCreatePRDialog] = useState(false);
	const [targetBranch, setTargetBranch] = useState(
		status?.targetBranch ?? "main",
	);
	const [error, setError] = useState<string | null>(null);
	const [primaryAction, setPrimaryAction] = useState<"merge" | "createPR">(
		"createPR",
	);
	const [showActionMenu, setShowActionMenu] = useState(false);
	const actionMenuRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (status?.targetBranch) {
			setTargetBranch(status.targetBranch);
		}
	}, [status?.targetBranch]);

	useEffect(() => {
		if (!showActionMenu) return;
		const handleClickOutside = (e: MouseEvent) => {
			if (
				actionMenuRef.current &&
				!actionMenuRef.current.contains(e.target as Node)
			) {
				setShowActionMenu(false);
			}
		};
		document.addEventListener("mousedown", handleClickOutside);
		return () => document.removeEventListener("mousedown", handleClickOutside);
	}, [showActionMenu]);

	// Auto-finalize when PR is merged
	const finalizingRef = useRef(false);
	useEffect(() => {
		if (
			status?.prState === "merged" &&
			workspaceId &&
			projectId &&
			!finalizingRef.current &&
			!isFinalizingPrMerge
		) {
			finalizingRef.current = true;
			finalizePrMerge(workspaceId, projectId)
				.catch((err) => {
					setError(err instanceof Error ? err.message : "Finalize failed");
				})
				.finally(() => {
					finalizingRef.current = false;
				});
		}
	}, [
		status?.prState,
		workspaceId,
		projectId,
		finalizePrMerge,
		isFinalizingPrMerge,
	]);

	if (!workspaceId || !projectId || !status) {
		return null;
	}

	const prUrl = status.prUrl;

	const hasConflicts = status.conflictedFiles.length > 0;
	const isOperationInProgress =
		status.isRebaseInProgress || status.isMergeInProgress;
	const isReviewState = taskStatus === "inreview";
	// In review state, merge is only enabled when fast-forward is possible (behind === 0)
	const canMerge =
		!isMerging && !hasConflicts && (!isReviewState || status.behind === 0);

	const handleRebase = async () => {
		try {
			setError(null);
			const result = await rebase(workspaceId, projectId, targetBranch);
			setShowRebaseDialog(false);
			if (
				result.hasConflicts &&
				"conflictedFiles" in result &&
				result.conflictedFiles
			) {
				onConflict?.(result.conflictedFiles);
				// Hand the conflict off to the Coding Agent. The agent runs
				// autonomously in the worktree, resolves markers, and drives
				// `git rebase --continue` to completion. If it cannot resolve
				// some hunk, it stops with a user-visible message in the chat.
				try {
					await resolveRebaseConflict(workspaceId, projectId);
				} catch (agentErr) {
					setError(
						agentErr instanceof Error
							? `Agent conflict resolution failed: ${agentErr.message}`
							: "Agent conflict resolution failed",
					);
				}
			}
			refetch();
		} catch (err) {
			setError(err instanceof Error ? err.message : "Rebase failed");
		}
	};

	const handleAbortRebase = async () => {
		try {
			setError(null);
			await abortRebase(workspaceId, projectId);
			refetch();
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to abort rebase");
		}
	};

	const handleContinueRebase = async () => {
		try {
			setError(null);
			const result = await continueRebase(workspaceId, projectId);
			if (
				result.hasConflicts &&
				"conflictedFiles" in result &&
				result.conflictedFiles
			) {
				onConflict?.(result.conflictedFiles);
			}
			refetch();
		} catch (err) {
			setError(
				err instanceof Error ? err.message : "Failed to continue rebase",
			);
		}
	};

	const handleMerge = async () => {
		try {
			setError(null);
			await merge(workspaceId, projectId, targetBranch);
			setShowMergeDialog(false);
			refetch();
		} catch (err) {
			setError(err instanceof Error ? err.message : "Merge failed");
		}
	};

	return (
		<div className="flex items-center gap-3">
			{/* Error display */}
			{error && (
				<div className="flex items-center gap-1 text-sm text-red-600">
					<AlertCircle className="h-4 w-4" />
					<span>{error}</span>
				</div>
			)}

			{/* Conflict indicator */}
			{hasConflicts && (
				<div className="flex items-center gap-1 rounded-md bg-red-100 px-2 py-1 text-sm text-red-700">
					<AlertCircle className="h-4 w-4" />
					<span>{status.conflictedFiles.length} conflicts</span>
				</div>
			)}

			{/* Operation buttons */}
			{isOperationInProgress ? (
				<>
					<button
						type="button"
						onClick={handleAbortRebase}
						disabled={isAbortingRebase}
						className="flex items-center gap-2 rounded-md border border-[#E4E4E7] bg-[#F5F5F5] px-4 py-2.5 text-sm font-medium text-[#0A0A0B] hover:opacity-80 transition-colors disabled:opacity-50"
					>
						Abort
					</button>
					{!hasConflicts && (
						<button
							type="button"
							onClick={handleContinueRebase}
							disabled={isContinuingRebase}
							className="flex items-center gap-2 rounded-md bg-[#E87B35] px-4 py-2.5 text-sm font-medium text-white hover:opacity-90 transition-colors disabled:opacity-50"
						>
							<RefreshCw className="h-4 w-4" />
							Continue
						</button>
					)}
				</>
			) : (
				<>
					{/* Split button: Merge / Create PR */}
					{status.prState === "merged" || isFinalizingPrMerge ? (
						<div className="flex items-center gap-1.5 rounded-md bg-green-600 px-4 py-2.5 text-sm font-medium text-white">
							<CheckCircle className="h-4 w-4" />
							{isFinalizingPrMerge ? "Finalizing..." : "PR Merged"}
						</div>
					) : prUrl ? (
						<a
							href={prUrl}
							target="_blank"
							rel="noopener noreferrer"
							className="flex items-center gap-1.5 rounded-md bg-[#E87B35] px-4 py-2.5 text-sm font-medium text-white hover:opacity-90 transition-colors"
						>
							View PR
							<ExternalLink className="h-3.5 w-3.5" />
						</a>
					) : (
						<div className="relative" ref={actionMenuRef}>
							<div className="flex">
								{/* Main action button */}
								<button
									type="button"
									onClick={() => {
										if (primaryAction === "merge") {
											setShowMergeDialog(true);
										} else {
											setShowCreatePRDialog(true);
										}
									}}
									disabled={
										primaryAction === "merge"
											? !canMerge
											: status.ahead === 0 && diffs.length === 0
									}
									className={cn(
										"flex items-center justify-center rounded-l-md bg-[#E87B35] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed",
									)}
									title={
										primaryAction === "merge" &&
										isReviewState &&
										status.behind > 0
											? "Rebase required before merge (not fast-forwardable)"
											: undefined
									}
								>
									{primaryAction === "merge" ? "Merge" : "Create PR"}
								</button>
								{/* Dropdown toggle */}
								<button
									type="button"
									onClick={() => setShowActionMenu(!showActionMenu)}
									className="flex items-center justify-center rounded-r-md border-l border-white/30 bg-[#E87B35] px-2 py-2.5 text-white transition-colors hover:opacity-90"
								>
									<ChevronDown className="h-4 w-4" />
								</button>
							</div>
							{/* Dropdown menu */}
							{showActionMenu && (
								<div className="absolute right-0 top-full z-10 mt-1 w-40 rounded-md border border-[#E4E4E7] bg-white py-1 shadow-lg">
									<button
										type="button"
										onClick={() => {
											setPrimaryAction("merge");
											setShowActionMenu(false);
										}}
										className={cn(
											"flex w-full items-center px-3 py-2 text-sm transition-colors hover:bg-[#F5F5F5]",
											primaryAction === "merge"
												? "font-semibold text-[#E87B35]"
												: "text-[#0A0A0B]",
										)}
									>
										Merge
									</button>
									<button
										type="button"
										onClick={() => {
											setPrimaryAction("createPR");
											setShowActionMenu(false);
										}}
										className={cn(
											"flex w-full items-center px-3 py-2 text-sm transition-colors hover:bg-[#F5F5F5]",
											primaryAction === "createPR"
												? "font-semibold text-[#E87B35]"
												: "text-[#0A0A0B]",
										)}
									>
										Create PR
									</button>
								</div>
							)}
						</div>
					)}

					{/* Rebase button - accent filled in review state, outline otherwise */}
					<button
						type="button"
						onClick={() => setShowRebaseDialog(true)}
						disabled={isRebasing || hasConflicts}
						className={cn(
							"flex items-center justify-center rounded-md px-4 py-2.5 text-sm font-medium transition-colors disabled:opacity-50",
							isReviewState
								? "bg-[#E87B35] text-white hover:opacity-90"
								: "border border-[#E4E4E7] bg-[#F5F5F5] text-[#0A0A0B] hover:opacity-80",
						)}
					>
						Rebase
					</button>
				</>
			)}

			{/* Rebase Dialog */}
			<Dialog
				open={showRebaseDialog}
				onClose={() => setShowRebaseDialog(false)}
			>
				<DialogHeader onClose={() => setShowRebaseDialog(false)}>
					Rebase onto branch
				</DialogHeader>
				<DialogContent>
					<div className="space-y-4">
						<BranchCombobox
							label="Target Branch"
							branches={branchData?.branches ?? []}
							value={targetBranch}
							onChange={setTargetBranch}
							placeholder="Search branches..."
						/>
						<div className="flex justify-end gap-2">
							<Button
								variant="outline"
								onClick={() => setShowRebaseDialog(false)}
							>
								Cancel
							</Button>
							<Button onClick={handleRebase} disabled={isRebasing}>
								{isRebasing ? "Rebasing..." : "Rebase"}
							</Button>
						</div>
					</div>
				</DialogContent>
			</Dialog>

			{/* Merge Dialog */}
			<Dialog open={showMergeDialog} onClose={() => setShowMergeDialog(false)}>
				<DialogHeader onClose={() => setShowMergeDialog(false)}>
					Merge into branch
				</DialogHeader>
				<DialogContent>
					<div className="space-y-4">
						<BranchCombobox
							label="Target Branch"
							branches={branchData?.branches ?? []}
							value={targetBranch}
							onChange={setTargetBranch}
							placeholder="Search branches..."
						/>
						<p className="text-sm text-muted">
							This will fast-forward merge your changes into {targetBranch}.
						</p>
						<div className="flex justify-end gap-2">
							<Button
								variant="outline"
								onClick={() => setShowMergeDialog(false)}
							>
								Cancel
							</Button>
							<Button onClick={handleMerge} disabled={isMerging}>
								{isMerging ? "Merging..." : "Merge"}
							</Button>
						</div>
					</div>
				</DialogContent>
			</Dialog>

			{/* Create PR Dialog */}
			<CreatePRDialog
				open={showCreatePRDialog}
				onClose={() => {
					setShowCreatePRDialog(false);
					refetch();
				}}
				workspaceId={workspaceId}
				projectId={projectId}
				taskTitle={taskTitle ?? ""}
			/>
		</div>
	);
}
