import { MessageSquare, RotateCcw, Square } from "lucide-react";
import { ChatContainer } from "@/components/chat";
import { FollowUpInput } from "@/components/chat/FollowUpInput";
import { PermissionResponseInput } from "@/components/chat/PermissionResponseInput";
import { PlanResponseInput } from "@/components/chat/PlanResponseInput";
import { useTodoProgress } from "@/hooks/useTodoProgress";
import { trpc } from "@/trpc";
import { type AttemptSummary, AttemptSwitcher } from "./AttemptSwitcher";
import { TodoProgressPopup } from "./TodoProgressPopup";
import type { ConversationEntry } from "./types";

interface ConversationPanelProps {
	workspaceId: string | null;
	executionProcessId: string | null;
	sessionId: string | null;
	isRunning: boolean;
	onStop?: () => void;
	isStopping?: boolean;
	onStartAgent?: () => void;
	onExecutionStarted?: (executionProcessId: string) => void;
	isHistoricalView?: boolean;
	attempts?: AttemptSummary[];
	activeAttempt?: number | null;
	selectedAttempt?: number;
	onSelectAttempt?: (attempt: AttemptSummary) => void;
}

export function ConversationPanel({
	workspaceId: _workspaceId,
	executionProcessId,
	sessionId,
	isRunning,
	onStop,
	isStopping,
	onStartAgent,
	onExecutionStarted,
	isHistoricalView,
	attempts,
	activeAttempt,
	selectedAttempt,
	onSelectAttempt,
}: ConversationPanelProps) {
	// Get conversation history (all EPs in this session)
	const { data: historyData } = trpc.execution.getConversationHistory.useQuery(
		{ sessionId: sessionId ?? "" },
		{ enabled: !!sessionId, refetchInterval: 5000 },
	);

	// Get structured logs for the current execution process (for pending state detection)
	const { data: structuredLogsData } =
		trpc.execution.getStructuredLogs.useQuery(
			{ executionProcessId: executionProcessId ?? "" },
			{ enabled: !!executionProcessId && isRunning, refetchInterval: 1000 },
		);

	const currentEntries = (structuredLogsData?.entries ??
		[]) as ConversationEntry[];

	// Extract todo progress from current entries
	const todoProgress = useTodoProgress(currentEntries);

	// Detect permission pending state
	const { data: pendingPermissionsData } =
		trpc.execution.getPendingPermissions.useQuery(
			{ sessionId: sessionId ?? "" },
			{ enabled: !!sessionId && isRunning, refetchInterval: 1000 },
		);
	const pendingPermissions = pendingPermissionsData?.permissions ?? [];
	const hasPermissionPending = pendingPermissions.length > 0;

	// Detect plan pending via approval API
	const { data: pendingApprovalsData } = trpc.approval.getPending.useQuery(
		{ executionProcessId: executionProcessId ?? "" },
		{ enabled: !!executionProcessId && isRunning, refetchInterval: 1000 },
	);
	const pendingApprovals = pendingApprovalsData?.approvals ?? [];
	const planApproval = pendingApprovals.find(
		(a) => a.toolName === "ExitPlanMode",
	);

	// Determine which input to show
	const showPlanResponseInput = !!planApproval && !!executionProcessId;
	const showPermissionResponseInput =
		!showPlanResponseInput && hasPermissionPending;

	const conversationHistory = historyData?.turns ?? [];

	// Split into past EPs and current EP
	const pastTurns = conversationHistory.filter(
		(turn) => turn.executionProcessId !== executionProcessId,
	);
	const currentTurn = conversationHistory.find(
		(turn) => turn.executionProcessId === executionProcessId,
	);

	// Determine if execution has been completed (for "Completed" status display)
	const latestTurn =
		conversationHistory.length > 0
			? conversationHistory[conversationHistory.length - 1]
			: null;
	const isCompleted = latestTurn?.status === "completed" && !isRunning;

	return (
		<div className="flex h-full flex-col">
			{/* Header */}
			<div className="flex items-center justify-between border-b border-border bg-secondary px-6 py-4">
				<div className="flex items-center gap-3">
					<div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent">
						<span className="text-sm font-bold text-white">C</span>
					</div>
					<span className="text-base font-semibold text-primary-foreground">
						Claude Code
					</span>
					{/* Attempt Switcher */}
					{attempts && selectedAttempt && onSelectAttempt && (
						<AttemptSwitcher
							attempts={attempts}
							activeAttempt={activeAttempt ?? null}
							selectedAttempt={selectedAttempt}
							onSelectAttempt={onSelectAttempt}
						/>
					)}
					{/* Status indicator */}
					{isHistoricalView && (
						<div className="flex items-center gap-2">
							<div className="h-2 w-2 rounded-sm bg-muted" />
							<span className="text-[13px] text-muted">Archived</span>
						</div>
					)}
					{!isHistoricalView && isRunning && (
						<div className="flex items-center gap-2">
							<div className="h-2 w-2 rounded-sm bg-success" />
							<span className="text-[13px] text-success">Running</span>
						</div>
					)}
					{!isHistoricalView && isCompleted && !isRunning && (
						<div className="flex items-center gap-2">
							<div className="h-2 w-2 rounded-sm bg-secondary-foreground" />
							<span className="text-[13px] text-secondary-foreground">
								Completed
							</span>
						</div>
					)}
				</div>
				<div className="flex items-center gap-2">
					<TodoProgressPopup {...todoProgress} />
					{/* Stop button - only shown when running and not in historical view */}
					{!isHistoricalView && isRunning && onStop && (
						<button
							type="button"
							onClick={onStop}
							disabled={isStopping}
							className="flex items-center gap-2 rounded-md bg-destructive px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
						>
							<Square className="h-3.5 w-3.5" />
							{isStopping ? "Stopping..." : "Stop"}
						</button>
					)}
				</div>
			</div>

			{/* Scrollable content area - continuous chat stream */}
			<div className="flex flex-1 flex-col overflow-y-auto">
				{/* All EPs rendered continuously with session separators */}
				{sessionId && conversationHistory.length > 0 ? (
					<div className="flex flex-col">
						{/* Past EPs - each with full ChatContainer */}
						{pastTurns.map((turn, index) => (
							<div key={turn.id}>
								{/* Session separator between EPs */}
								{index > 0 && <SessionSeparator />}
								<ChatContainer
									executionProcessId={turn.executionProcessId}
									isRunning={false}
									sessionId={sessionId}
								/>
							</div>
						))}

						{/* Separator before current EP (if there are past turns) */}
						{pastTurns.length > 0 && currentTurn && <SessionSeparator />}

						{/* Current EP - live */}
						{executionProcessId && (
							<div className="flex-1">
								<ChatContainer
									executionProcessId={executionProcessId}
									isRunning={isRunning}
									isAwaitingApproval={
										showPlanResponseInput || showPermissionResponseInput
									}
									sessionId={sessionId}
								/>
							</div>
						)}
					</div>
				) : (
					/* Empty state - no session or no history */
					<div className="flex-1 bg-primary">
						{executionProcessId ? (
							<ChatContainer
								executionProcessId={executionProcessId}
								isRunning={isRunning}
								isAwaitingApproval={
									showPlanResponseInput || showPermissionResponseInput
								}
								sessionId={sessionId}
								onExecutionStarted={onExecutionStarted}
							/>
						) : sessionId ? (
							<div className="flex h-full items-center justify-center text-muted">
								Waiting for next execution...
							</div>
						) : (
							<div className="flex h-full flex-col items-center justify-center gap-4 p-8 bg-primary">
								<MessageSquare className="h-12 w-12 text-muted" />
								<p className="text-base font-semibold text-primary-foreground text-center">
									No execution started yet
								</p>
								<p className="text-sm text-muted text-center">
									Start an agent to begin working on this task
								</p>
								{!isHistoricalView && onStartAgent && (
									<button
										type="button"
										onClick={onStartAgent}
										className="flex items-center justify-center rounded-md bg-accent px-4 py-2.5 text-sm font-medium text-white hover:bg-accent-hover"
									>
										Start Agent
									</button>
								)}
							</div>
						)}
					</div>
				)}
			</div>

			{/* Input area - hidden in historical view */}
			{!isHistoricalView &&
				sessionId &&
				showPlanResponseInput &&
				planApproval && (
					<PlanResponseInput
						approvalId={planApproval.id}
						executionProcessId={executionProcessId as string}
					/>
				)}
			{!isHistoricalView && sessionId && showPermissionResponseInput && (
				<PermissionResponseInput
					sessionId={sessionId}
					permissions={pendingPermissions.map((p) => ({
						requestId: p.requestId,
						toolName: p.toolName,
						toolInput: p.toolInput as Record<string, unknown>,
					}))}
				/>
			)}
			{!isHistoricalView &&
				sessionId &&
				!showPlanResponseInput &&
				!showPermissionResponseInput && (
					<FollowUpInput
						sessionId={sessionId}
						onExecutionStarted={onExecutionStarted}
					/>
				)}
		</div>
	);
}

/** Visual separator indicating a Claude session boundary */
function SessionSeparator() {
	return (
		<div className="flex items-center gap-3 px-6 py-3">
			<div className="flex-1 border-t border-border" />
			<div className="flex items-center gap-1.5 text-muted">
				<RotateCcw className="h-3 w-3" />
				<span className="text-[11px] font-medium">Session restarted</span>
			</div>
			<div className="flex-1 border-t border-border" />
		</div>
	);
}
