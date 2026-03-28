import {
	CheckCircle,
	ChevronDown,
	ChevronUp,
	ClipboardList,
	Loader2,
	XCircle,
} from "lucide-react";
import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { PlanAction, ToolEntry as ToolEntryType } from "./types";

interface PlanCardProps {
	entry: ToolEntryType;
}

/**
 * PlanCard - Display-only card for ExitPlanMode tool results.
 *
 * Per Pencil design (9mVbW): Shows plan content only, no buttons.
 * Approve/Reject buttons are in PlanResponseInput (replaces chat input).
 * Border color indicates state: orange(pending), green(approved), red(rejected).
 */
export function PlanCard({ entry }: PlanCardProps) {
	const [expanded, setExpanded] = useState(true);

	const planAction = entry.action as PlanAction;
	const planStatus =
		planAction.planStatus ??
		(entry.status === "success" ? "pending" : undefined);

	const isPlanApproved = planStatus === "approved";
	const isPlanRejected = planStatus === "rejected";

	const planContent =
		planAction.plan ?? entry.result?.output ?? "Plan content loading...";

	const statusIcon =
		entry.status === "running" ? (
			<Loader2 className="h-5 w-5 animate-spin text-warning" />
		) : isPlanApproved ? (
			<CheckCircle className="h-5 w-5 text-success" />
		) : isPlanRejected ? (
			<XCircle className="h-5 w-5 text-destructive" />
		) : (
			<ClipboardList className="h-5 w-5 text-warning" />
		);

	const borderColor = isPlanApproved
		? "border-success"
		: isPlanRejected
			? "border-destructive"
			: "border-warning";

	return (
		<div
			data-plan-card
			className={`ml-9 overflow-hidden rounded-lg border-2 ${borderColor} bg-secondary`}
		>
			{/* Header */}
			<button
				type="button"
				onClick={() => setExpanded(!expanded)}
				className="flex w-full items-center gap-3 bg-secondary px-4 py-3 transition-colors hover:bg-hover"
			>
				{statusIcon}
				<span className="text-base font-semibold text-warning">
					Implementation Plan
				</span>
				<span className="ml-auto flex items-center gap-2 text-sm text-warning">
					{expanded ? (
						<ChevronUp className="h-4 w-4" />
					) : (
						<ChevronDown className="h-4 w-4" />
					)}
				</span>
			</button>

			{/* Content */}
			{expanded && (
				<div className={`border-t ${borderColor}`}>
					<div className="p-4">
						<div className="prose prose-sm prose-orange max-w-none">
							<ReactMarkdown remarkPlugins={[remarkGfm]}>
								{planContent}
							</ReactMarkdown>
						</div>
					</div>

					{/* Status indicators */}
					{isPlanApproved && (
						<div className="flex items-center gap-2 border-t border-success bg-success/10 px-4 py-2 text-sm text-success">
							<CheckCircle className="h-4 w-4" />
							Plan approved - implementation in progress
						</div>
					)}
					{isPlanRejected && (
						<div className="flex items-center gap-2 border-t border-destructive bg-destructive/10 px-4 py-2 text-sm text-destructive">
							<XCircle className="h-4 w-4" />
							Plan rejected
						</div>
					)}
				</div>
			)}
		</div>
	);
}
