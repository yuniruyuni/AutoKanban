import { CheckCircle, ClipboardList, Loader2, XCircle } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useApprovalMutation } from "@/hooks/useApprovalMutation";
import { cn } from "@/lib/utils";

interface PlanResponseInputProps {
	approvalId: string;
	executionProcessId: string;
}

/**
 * PlanResponseInput - Replaces chat input when plan approval is pending.
 *
 * - Empty input: shows Approve button (Cmd+Enter to approve)
 * - Non-empty input: shows Reject button (Cmd+Enter to reject with feedback)
 * - Enter inserts newline, Cmd+Enter submits
 */
export function PlanResponseInput({
	approvalId,
	executionProcessId,
}: PlanResponseInputProps) {
	const [feedback, setFeedback] = useState("");
	const { approve, deny, isPending } = useApprovalMutation();
	const textareaRef = useRef<HTMLTextAreaElement>(null);

	const hasFeedback = feedback.trim().length > 0;

	// Auto-resize textarea to fit content
	useEffect(() => {
		const el = textareaRef.current;
		if (!el) return;
		el.style.height = "auto";
		el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
	}, [feedback]);

	const handleApprove = useCallback(async () => {
		try {
			await approve(approvalId, executionProcessId);
		} catch (error) {
			console.error("Failed to approve plan:", error);
		}
	}, [approve, approvalId, executionProcessId]);

	const handleReject = useCallback(async () => {
		try {
			await deny(approvalId, executionProcessId, feedback || undefined);
			setFeedback("");
		} catch (error) {
			console.error("Failed to reject plan:", error);
		}
	}, [deny, approvalId, executionProcessId, feedback]);

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && !isPending) {
			e.preventDefault();
			if (hasFeedback) {
				handleReject();
			} else {
				handleApprove();
			}
		}
	};

	return (
		<div className="border-t border-border bg-secondary px-4 py-3">
			{/* Header */}
			<div className="flex items-center gap-2 mb-2">
				<ClipboardList className="h-3.5 w-3.5 text-warning" />
				<span className="text-xs font-semibold text-primary-foreground">
					Plan requires your response
				</span>
			</div>

			{/* Input row: textarea + action button */}
			<div className="flex items-end gap-2">
				<textarea
					ref={textareaRef}
					value={feedback}
					onChange={(e) => setFeedback(e.target.value)}
					onKeyDown={handleKeyDown}
					placeholder="Type feedback to reject..."
					disabled={isPending}
					rows={1}
					className="flex-1 resize-none rounded-md border border-border bg-primary px-3 py-2 text-sm placeholder:text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent disabled:opacity-50"
				/>
				{hasFeedback ? (
					<button
						type="button"
						onClick={handleReject}
						disabled={isPending}
						className={cn(
							"flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-colors whitespace-nowrap",
							"border border-destructive text-destructive hover:bg-destructive/10",
							"disabled:cursor-not-allowed disabled:opacity-50",
						)}
					>
						{isPending ? (
							<Loader2 className="h-3.5 w-3.5 animate-spin" />
						) : (
							<XCircle className="h-3.5 w-3.5" />
						)}
						Reject
						<kbd className="text-[10px] opacity-60">⌘↵</kbd>
					</button>
				) : (
					<button
						type="button"
						onClick={handleApprove}
						disabled={isPending}
						className={cn(
							"flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-colors whitespace-nowrap",
							"bg-success text-white hover:opacity-90",
							"disabled:cursor-not-allowed disabled:opacity-50",
						)}
					>
						{isPending ? (
							<Loader2 className="h-3.5 w-3.5 animate-spin" />
						) : (
							<CheckCircle className="h-3.5 w-3.5" />
						)}
						Approve
						<kbd className="text-[10px] opacity-60">⌘↵</kbd>
					</button>
				)}
			</div>
		</div>
	);
}
