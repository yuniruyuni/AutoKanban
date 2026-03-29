import { AlertTriangle, Bot, Minimize2, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useSnapshot } from "valtio";
import { Dialog, DialogContent } from "@/components/atoms/Dialog";
import { TabBar } from "@/components/atoms/TabBar";
import type { AttemptSummary } from "@/components/chat/AttemptSwitcher";
import { ConversationPanel } from "@/components/chat/ConversationPanel";
import { BranchInfo } from "@/components/task/BranchInfo";
import { DiffPanel } from "@/components/task/diff-panel";
import { GitOperationButtons } from "@/components/task/GitOperationButtons";
import { PreviewPanel } from "@/components/task/PreviewPanel";
import { useAttemptExecution } from "@/hooks/useAttemptExecution";
import { useAttempts } from "@/hooks/useAttempts";
import { useDevServerPreview } from "@/hooks/useDevServerPreview";
import { useExecutionStatus } from "@/hooks/useExecution";
import { useFollowUp } from "@/hooks/useFollowUp";
import { useBranchStatus } from "@/hooks/useGit";
import { useInlineEdit } from "@/hooks/useInlineEdit";
import { useLatestExecution } from "@/hooks/useLatestExecution";
import { useResizablePanel } from "@/hooks/useResizablePanel";
import { useTaskMutations } from "@/hooks/useTaskMutations";
import { STATUS_CONFIG } from "@/lib/constants";
import { getIconComponent } from "@/lib/icons";
import { cn } from "@/lib/utils";
import {
	executionActions,
	executionStore,
	toolStore,
	uiActions,
} from "@/store";
import { trpc } from "@/trpc";

const TABS = [
	{ id: "description", label: "Description" },
	{ id: "changes", label: "Changes" },
	{ id: "preview", label: "Preview" },
];

interface TaskDetailFullscreenProps {
	taskId: string;
	onBack: () => void;
	onMinimize?: () => void;
	onClose?: () => void;
}

export function TaskDetailFullscreen({
	taskId,
	onBack,
	onMinimize,
	onClose,
}: TaskDetailFullscreenProps) {
	const executionState = useSnapshot(executionStore);
	const { tools } = useSnapshot(toolStore);
	const [conflictedFiles, setConflictedFiles] = useState<string[]>([]);
	const [showConflictDialog, setShowConflictDialog] = useState(false);
	const [activeTab, setActiveTab] = useState("description");
	const {
		containerRef: splitRef,
		value: splitRatio,
		handleMouseDown: handleSplitMouseDown,
	} = useResizablePanel({ mode: "ratio", initial: 0.4, min: 0.2, max: 0.7 });
	const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string | null>(
		null,
	);

	// Load latest execution state from server (restores state after page reload)
	useLatestExecution(taskId);

	// Get execution info from UI store
	const executionInfo = executionState.activeExecutions[taskId];
	const storeSessionId = executionInfo?.sessionId ?? null;
	const storeExecutionProcessId = executionInfo?.executionProcessId ?? null;
	const storeWorkspaceId = executionInfo?.workspaceId ?? null;

	// Attempt management
	const { attempts, activeAttempt } = useAttempts(taskId);
	const attemptExecution = useAttemptExecution(selectedWorkspaceId);

	// Determine if viewing a historical (archived) attempt
	const selectedAttemptInfo = selectedWorkspaceId
		? attempts.find((a) => a.workspaceId === selectedWorkspaceId)
		: null;
	const isHistoricalView = selectedAttemptInfo?.archived ?? false;

	// Compute effective session/execution/workspace based on selection
	const sessionId = selectedWorkspaceId
		? attemptExecution.sessionId
		: storeSessionId;
	const executionProcessId = selectedWorkspaceId
		? attemptExecution.executionProcessId
		: storeExecutionProcessId;
	const workspaceId = selectedWorkspaceId ?? storeWorkspaceId;

	// Selected attempt number for AttemptSwitcher
	const selectedAttemptNumber =
		selectedAttemptInfo?.attempt ?? activeAttempt ?? 1;

	const handleSelectAttempt = (attempt: AttemptSummary) => {
		if (attempt.attempt === activeAttempt) {
			// Selecting current attempt - revert to store-driven state
			setSelectedWorkspaceId(null);
		} else {
			setSelectedWorkspaceId(attempt.workspaceId);
		}
	};

	// Get real-time execution status
	const { executionProcess } = useExecutionStatus(executionProcessId);
	const isRunning =
		!isHistoricalView &&
		(executionProcess?.status === "running" ||
			executionProcess?.status === "awaiting_approval");

	// Follow-up hook for conflict resolution
	const { send: sendFollowUp, isSending: isFollowUpSending } =
		useFollowUp(sessionId);

	// Get task details
	const { data: taskData } = trpc.task.get.useQuery({ taskId });
	const task = taskData ?? null;

	// Dev server preview
	const { data: projectData } = trpc.project.get.useQuery(
		{ projectId: task?.projectId ?? "" },
		{ enabled: !!task?.projectId },
	);
	const devServerPreview = useDevServerPreview({
		taskId,
		sessionId,
		projectHasDevServer: !!projectData?.devServerScript,
	});

	// Get branch status for BranchInfo
	const { status: branchStatus } = useBranchStatus(
		workspaceId,
		task?.projectId ?? null,
	);

	// Mutations
	const stopExecution = trpc.execution.stop.useMutation();
	const executeTool = trpc.tool.execute.useMutation();
	const { updateTask, deleteTask } = useTaskMutations();

	const saveTitle = useCallback(
		(title: string) => updateTask({ taskId, title }),
		[updateTask, taskId],
	);
	const saveDescription = useCallback(
		(description: string) => updateTask({ taskId, description }),
		[updateTask, taskId],
	);

	const titleEdit = useInlineEdit({
		value: taskData?.title ?? "",
		onSave: saveTitle,
	});
	const descEdit = useInlineEdit({
		value: taskData?.description ?? "",
		onSave: saveDescription,
		multiline: true,
	});

	// Fullscreen keyboard shortcuts: h/l for tab switching, Ctrl+j/k for chat scroll
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.defaultPrevented) return;

			const tag = (e.target as HTMLElement)?.tagName;
			const _isInput =
				tag === "INPUT" ||
				tag === "TEXTAREA" ||
				tag === "SELECT" ||
				(e.target as HTMLElement)?.isContentEditable;

			// Ctrl+h / Ctrl+l: switch tabs (even in input fields)
			if (e.ctrlKey && (e.key === "h" || e.key === "l")) {
				e.preventDefault();
				const currentIdx = TABS.findIndex((t) => t.id === activeTab);
				const nextIdx =
					e.key === "l"
						? Math.min(currentIdx + 1, TABS.length - 1)
						: Math.max(currentIdx - 1, 0);
				setActiveTab(TABS[nextIdx].id);
				return;
			}

			// Ctrl+n / Ctrl+p: scroll chat area (even in input fields)
			if (e.ctrlKey && (e.key === "n" || e.key === "p")) {
				e.preventDefault();
				const chatScroll = splitRef.current?.querySelector(".overflow-y-auto");
				if (chatScroll) {
					chatScroll.scrollBy({
						top: e.key === "n" ? 300 : -300,
						behavior: "smooth",
					});
				}
				return;
			}
		};

		document.addEventListener("keydown", handleKeyDown);
		return () => document.removeEventListener("keydown", handleKeyDown);
	}, [activeTab, splitRef]);

	const handleStartAgent = () => {
		if (!task) return;
		uiActions.openStartAgentDialog(task.id, task.projectId);
	};

	const handleStopExecution = async () => {
		if (!executionProcessId) return;

		try {
			await stopExecution.mutateAsync({ executionProcessId });
		} catch (error) {
			console.error("Failed to stop execution:", error);
		}
	};

	const handleConflict = (files: string[]) => {
		setConflictedFiles(files);
		setShowConflictDialog(true);
	};

	const handleToolClick = async (toolId: string) => {
		try {
			await executeTool.mutateAsync({ toolId, taskId });
		} catch (error) {
			console.error("Failed to execute tool:", error);
		}
	};

	const handleResolveWithClaude = async () => {
		// Use follow-up to send conflict resolution prompt
		if (!sessionId) return;

		const conflictPrompt = `
Please resolve the following merge conflicts:

Conflicted files:
${conflictedFiles.map((f) => `- ${f}`).join("\n")}

Steps to resolve:
1. Open each conflicted file
2. Find the conflict markers (<<<<<<, ======, >>>>>>)
3. Choose the correct resolution for each conflict
4. Remove the conflict markers
5. Stage the resolved files with \`git add\`

Please fix these conflicts and complete the rebase.
`.trim();

		try {
			await sendFollowUp(conflictPrompt);
			setShowConflictDialog(false);
		} catch (error) {
			console.error("Failed to start conflict resolution:", error);
		}
	};

	if (!task) {
		return (
			<div className="flex h-screen items-center justify-center">
				<div className="text-muted">Loading task...</div>
			</div>
		);
	}

	const statusConfig = STATUS_CONFIG[task.status];

	return (
		<div className="flex h-screen flex-col bg-white">
			{/* Top Bar - matches design: bg-[#F5F5F5], padding [16,24], gap-16, border bottom */}
			<header className="flex items-center gap-4 border-b border-[#E4E4E7] bg-[#F5F5F5] px-6 py-4">
				{/* Left: Title + Status Badge + Branch Info */}
				<div className="flex flex-1 items-center gap-3">
					{titleEdit.isEditing ? (
						<input
							ref={titleEdit.ref as React.RefObject<HTMLInputElement>}
							value={titleEdit.draft}
							onChange={(e) => titleEdit.setDraft(e.target.value)}
							onBlur={titleEdit.save}
							onKeyDown={titleEdit.handleKeyDown}
							className="text-xl font-semibold text-[#0A0A0B] bg-transparent border-b border-[#E4E4E7] outline-none"
						/>
					) : (
						<h1
							className="text-xl font-semibold text-[#0A0A0B] cursor-text rounded px-1 -mx-1 hover:bg-[#EBEBEB]"
							onClick={titleEdit.startEditing}
							onKeyDown={(e) => {
								if (e.key === "Enter") titleEdit.startEditing();
							}}
						>
							{task.title}
						</h1>
					)}
					<span
						className={cn(
							"inline-flex items-center rounded-sm px-2.5 py-1 text-xs font-semibold",
							statusConfig.bgColor,
							statusConfig.color,
						)}
					>
						{statusConfig.label}
					</span>
					{/* Branch Info */}
					{branchStatus?.branch && branchStatus.targetBranch && (
						<BranchInfo
							worktreeBranch={branchStatus.branch}
							baseBranch={branchStatus.targetBranch}
							ahead={branchStatus.ahead}
							behind={branchStatus.behind}
						/>
					)}
				</div>

				{/* Right: Actions - gap-3 between items */}
				<div className="flex items-center gap-3">
					{/* Git operations (Merge, Rebase, Push) */}
					<GitOperationButtons
						workspaceId={workspaceId}
						projectId={task.projectId}
						taskStatus={task.status}
						taskTitle={task.title}
						onConflict={handleConflict}
					/>

					{/* Tool buttons - gap-1 between icon buttons */}
					{tools.length > 0 && (
						<div className="flex items-center gap-1">
							{tools.map((tool) => {
								const IconComponent = getIconComponent(tool.icon);
								return (
									<button
										type="button"
										key={tool.id}
										className="flex h-8 w-8 items-center justify-center rounded-md bg-[#EBEBEB] transition-colors hover:opacity-80"
										onClick={() => handleToolClick(tool.id)}
										title={tool.name}
									>
										{IconComponent && (
											<IconComponent className="h-4 w-4 text-[#71717A]" />
										)}
									</button>
								);
							})}
						</div>
					)}

					{/* Delete button */}
					<button
						type="button"
						className="flex h-8 w-8 items-center justify-center rounded-md bg-[#EBEBEB] transition-colors hover:bg-red-50 hover:text-red-600"
						onClick={() => {
							uiActions.openConfirmDialog(
								"Are you sure you want to delete this task? This action cannot be undone.",
								() => {
									deleteTask(task.id);
									onBack();
								},
							);
						}}
						title="Delete task"
					>
						<Trash2 className="h-4 w-4 text-[#71717A]" />
					</button>

					{/* Minimize button */}
					{onMinimize && (
						<button
							type="button"
							className="flex h-8 w-8 items-center justify-center rounded-md bg-[#EBEBEB] transition-colors hover:opacity-80"
							onClick={onMinimize}
							title="Minimize to side panel"
						>
							<Minimize2 className="h-4 w-4 text-[#71717A]" />
						</button>
					)}

					{/* Close button */}
					<button
						type="button"
						className="flex h-8 w-8 items-center justify-center rounded-md bg-[#EBEBEB] transition-colors hover:opacity-80"
						onClick={onClose ?? onBack}
						title="Close"
					>
						<X className="h-4 w-4 text-[#71717A]" />
					</button>
				</div>
			</header>

			{/* Main content - split view */}
			<div ref={splitRef} className="flex flex-1 overflow-hidden">
				{/* Left panel - Conversation (resizable) */}
				<div
					className="min-w-0 h-full overflow-hidden"
					style={{ width: `${splitRatio * 100}%` }}
				>
					<ConversationPanel
						workspaceId={workspaceId}
						executionProcessId={executionProcessId}
						sessionId={sessionId}
						isRunning={isRunning}
						onStop={handleStopExecution}
						isStopping={stopExecution.isPending}
						onStartAgent={handleStartAgent}
						onExecutionStarted={(newExecutionProcessId) => {
							// Update the UI store with the new execution process ID
							if (sessionId && workspaceId) {
								executionActions.startExecution(
									taskId,
									newExecutionProcessId,
									sessionId,
									workspaceId,
								);
							}
						}}
						isHistoricalView={isHistoricalView}
						attempts={attempts}
						activeAttempt={activeAttempt}
						selectedAttempt={selectedAttemptNumber}
						onSelectAttempt={handleSelectAttempt}
					/>
				</div>

				{/* Resize handle */}
				{/* biome-ignore lint/a11y/noStaticElementInteractions: resize handle uses mouse drag */}
				<div
					className="w-1 bg-border hover:bg-accent cursor-col-resize flex-shrink-0 transition-colors"
					onMouseDown={handleSplitMouseDown}
				/>

				{/* Right panel - Tabs (Description / Changes) with bg-[#F5F5F5] */}
				<div
					className="min-w-0 h-full flex flex-col overflow-hidden bg-[#F5F5F5]"
					style={{ width: `${(1 - splitRatio) * 100}%` }}
				>
					<TabBar tabs={TABS} activeTab={activeTab} onChange={setActiveTab} />
					<div className="flex-1 overflow-hidden">
						{activeTab === "description" ? (
							<div className="space-y-4 p-6 overflow-auto h-full">
								<h3 className="text-xs font-semibold text-[#A1A1AA]">
									Task Description
								</h3>
								{descEdit.isEditing ? (
									<textarea
										ref={descEdit.ref as React.RefObject<HTMLTextAreaElement>}
										value={descEdit.draft}
										onChange={(e) => descEdit.setDraft(e.target.value)}
										onBlur={descEdit.save}
										onKeyDown={descEdit.handleKeyDown}
										rows={6}
										className="w-full text-sm leading-[1.6] text-[#71717A] bg-transparent border border-[#E4E4E7] rounded outline-none resize-y p-2"
									/>
								) : (
									<p
										className="text-sm leading-[1.6] text-[#71717A] whitespace-pre-wrap cursor-text rounded px-2 -mx-2 py-1 hover:bg-[#EBEBEB] min-h-[2em]"
										onClick={descEdit.startEditing}
										onKeyDown={(e) => {
											if (e.key === "Enter") descEdit.startEditing();
										}}
									>
										{task.description || "Add description..."}
									</p>
								)}
							</div>
						) : activeTab === "preview" ? (
							<PreviewPanel
								preview={devServerPreview}
								logs={devServerPreview.logs}
								isStreaming={devServerPreview.isStreaming}
							/>
						) : (
							<DiffPanel workspaceId={workspaceId} projectId={task.projectId} />
						)}
					</div>
				</div>
			</div>

			{/* Conflict Resolution Dialog */}
			<Dialog
				open={showConflictDialog}
				onClose={() => setShowConflictDialog(false)}
				width={520}
			>
				{/* Custom header matching design */}
				<div className="flex items-center justify-between border-b border-[#E4E4E7] px-6 py-5">
					<div className="flex items-center gap-2.5">
						<AlertTriangle className="h-5 w-5 text-[#EAB308]" />
						<span className="text-base font-semibold text-[#EAB308]">
							Rebase Conflicts Detected
						</span>
					</div>
					<button
						type="button"
						onClick={() => setShowConflictDialog(false)}
						className="flex h-8 w-8 items-center justify-center rounded-md bg-[#EBEBEB] transition-colors hover:opacity-80"
					>
						<X className="h-4 w-4 text-[#A1A1AA]" />
					</button>
				</div>

				{/* Body */}
				<DialogContent className="gap-4">
					<p className="text-sm text-[#71717A]">
						Rebase encountered conflicts with the base branch. The following
						files need to be resolved:
					</p>
					<div className="rounded-md bg-[#F5F5F5] p-3 space-y-1">
						{conflictedFiles.map((file) => (
							<div key={file} className="flex items-center gap-2 py-0.5">
								<AlertTriangle className="h-3.5 w-3.5 text-[#EAB308] flex-shrink-0" />
								<code className="text-[13px] text-[#71717A] font-mono">
									{file}
								</code>
							</div>
						))}
					</div>
				</DialogContent>

				{/* Footer */}
				<div className="flex items-center justify-end gap-3 border-t border-[#E4E4E7] px-6 py-4">
					<button
						type="button"
						onClick={() => setShowConflictDialog(false)}
						className="flex items-center justify-center rounded-md border border-[#E4E4E7] bg-[#F5F5F5] px-4 py-2.5 text-sm font-medium text-[#0A0A0B] transition-colors hover:opacity-80"
					>
						Cancel
					</button>
					<button
						type="button"
						onClick={handleResolveWithClaude}
						disabled={isFollowUpSending || !sessionId}
						className="flex items-center gap-2 rounded-md bg-[#E87B35] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:opacity-90 disabled:opacity-50"
					>
						<Bot className="h-4 w-4" />
						{isFollowUpSending ? "Resolving..." : "Resolve with Claude"}
					</button>
				</div>
			</Dialog>
		</div>
	);
}
