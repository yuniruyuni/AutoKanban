import { Square } from "lucide-react";
import { useEffect, useMemo } from "react";
import { Button } from "@/components/atoms/Button";
import { ChatContainer } from "@/components/chat";
import { useExecutionStatus } from "../../hooks/useExecution";
import { cn } from "../../lib/utils";
import type { TaskStatus } from "../../store";
import { executionActions } from "../../store";
import { trpc } from "../../trpc";
import { FollowUpInput } from "./FollowUpInput";
import { PermissionResponseInput } from "./PermissionResponseInput";
import { PlanResponseInput } from "./PlanResponseInput";
import { TokenUsageBar } from "./TokenUsageBar";
import type { TokenUsageEntry } from "./types";

interface ExecutionPanelProps {
	taskId: string;
	taskTitle: string;
	sessionId: string | null;
	executionProcessId: string | null;
	taskStatus: TaskStatus;
	className?: string;
	onStartAgent?: () => void;
	onStop?: () => void;
	isStopping?: boolean;
}

export function ExecutionPanel({
	taskId,
	taskTitle: _taskTitle,
	sessionId,
	executionProcessId,
	taskStatus,
	className,
	onStartAgent,
	onStop,
	isStopping = false,
}: ExecutionPanelProps) {
	const { executionProcess } = useExecutionStatus(executionProcessId);
	const isRunning =
		executionProcess?.status === "running" ||
		executionProcess?.status === "awaiting_approval";

	// Get token usage from structured logs
	const { data: structuredData } = trpc.execution.getStructuredLogs.useQuery(
		{ executionProcessId: executionProcessId ?? "" },
		{
			enabled: !!executionProcessId,
			refetchInterval: isRunning ? 1000 : false,
		},
	);

	const latestTokenUsage = useMemo(() => {
		if (!structuredData?.entries) return null;
		// Find the last token_usage entry
		for (let i = structuredData.entries.length - 1; i >= 0; i--) {
			if (structuredData.entries[i].type.kind === "token_usage") {
				return structuredData.entries[i].type as TokenUsageEntry;
			}
		}
		return null;
	}, [structuredData?.entries]);

	// Detect pending approvals (plan approval via API)
	const { data: pendingApprovalsData } = trpc.approval.getPending.useQuery(
		{ executionProcessId: executionProcessId ?? "" },
		{ enabled: !!executionProcessId && isRunning, refetchInterval: 1000 },
	);
	const pendingApprovals = pendingApprovalsData?.approvals ?? [];
	const planApproval = pendingApprovals.find(
		(a) => a.toolName === "ExitPlanMode",
	);

	// Detect pending permissions
	const { data: pendingPermissionsData } =
		trpc.execution.getPendingPermissions.useQuery(
			{ sessionId: sessionId ?? "" },
			{ enabled: !!sessionId && isRunning, refetchInterval: 1000 },
		);
	const pendingPermissions = pendingPermissionsData?.permissions ?? [];
	const hasPermissionPending = pendingPermissions.length > 0;

	// Determine which input to show
	const showPlanResponseInput = !!planApproval && !!executionProcessId;
	const showPermissionResponseInput =
		!showPlanResponseInput && hasPermissionPending;

	// Sync execution status with UI store for task card indicators
	useEffect(() => {
		if (executionProcess) {
			executionActions.updateExecutionStatus(taskId, executionProcess.status);
		}
	}, [taskId, executionProcess?.status, executionProcess]);

	// Render the appropriate input area
	const renderInput = () => {
		if (!sessionId) return null;

		if (showPlanResponseInput && planApproval) {
			return (
				<PlanResponseInput
					approvalId={planApproval.id}
					executionProcessId={executionProcessId!}
				/>
			);
		}

		if (showPermissionResponseInput) {
			return (
				<PermissionResponseInput
					sessionId={sessionId}
					permissions={pendingPermissions.map((p) => ({
						requestId: p.requestId,
						toolName: p.toolName,
						toolInput: p.toolInput as Record<string, unknown>,
					}))}
				/>
			);
		}

		return <FollowUpInput sessionId={sessionId} />;
	};

	// Render different UI based on task status
	const renderContent = () => {
		// TODO state - show Start Agent button
		if (taskStatus === "todo") {
			return (
				<div className="flex flex-col items-center justify-center h-full gap-4 text-muted">
					<p>No execution started yet</p>
					{onStartAgent && <Button onClick={onStartAgent}>Start Agent</Button>}
				</div>
			);
		}

		// In Progress or In Review - show chat and follow-up input
		if (taskStatus === "inprogress" || taskStatus === "inreview") {
			return (
				<>
					{/* Chat Container */}
					<div className="flex-1 overflow-y-auto bg-primary">
						{executionProcessId ? (
							<ChatContainer
								executionProcessId={executionProcessId}
								isRunning={isRunning}
								isAwaitingApproval={showPlanResponseInput || showPermissionResponseInput}
								sessionId={sessionId}
							/>
						) : (
							<div className="flex h-full items-center justify-center text-muted">
								Waiting for execution to start...
							</div>
						)}
					</div>

					{/* Input area */}
					<div className="border-t bg-secondary">
						{renderInput()}
					</div>
				</>
			);
		}

		// Done or Cancelled - show chat only (read-only)
		return (
			<div className="flex-1 overflow-y-auto bg-primary">
				{executionProcessId ? (
					<ChatContainer
						executionProcessId={executionProcessId}
						isRunning={false}
						sessionId={sessionId}
						onStartAgent={onStartAgent}
					/>
				) : (
					<div className="flex items-center justify-center h-full text-muted">
						No execution data available
					</div>
				)}
			</div>
		);
	};

	return (
		<div className={cn("flex flex-col h-full", className)}>
			{/* Chat Header */}
			<div className="flex items-center justify-between px-4 py-3 border-b border-border">
				<div className="flex items-center gap-2">
					{/* Claude icon */}
					<div className="flex h-6 w-6 items-center justify-center rounded-full bg-accent">
						<span className="text-xs font-bold text-white">C</span>
					</div>
					<span className="text-sm font-semibold">Claude Code</span>
					{/* Status indicator */}
					{isRunning && (
						<div className="flex items-center gap-1.5">
							<div className="h-2 w-2 rounded-full bg-success" />
							<span className="text-xs text-success">Running</span>
						</div>
					)}
					{/* Token usage gauge */}
					{latestTokenUsage && <TokenUsageBar usage={latestTokenUsage} />}
				</div>
				{/* Stop button */}
				{isRunning && onStop && (
					<button
						type="button"
						onClick={onStop}
						disabled={isStopping}
						className="flex items-center gap-1.5 rounded px-3 py-1.5 bg-destructive text-white text-xs font-medium hover:opacity-90 disabled:opacity-50"
					>
						<Square className="h-3 w-3" />
						{isStopping ? "Stopping..." : "Stop"}
					</button>
				)}
			</div>

			{/* Content based on task status */}
			<div className="flex-1 flex flex-col overflow-hidden">
				{renderContent()}
			</div>
		</div>
	);
}
