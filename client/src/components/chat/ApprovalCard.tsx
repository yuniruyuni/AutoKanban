import { ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ToolStatus } from "./types";

interface ApprovalCardProps {
	toolName: string;
	status: ToolStatus;
}

/**
 * ApprovalCard - Display-only card for permission approval requests.
 *
 * Per Pencil design (vMHdA, timer removed):
 * Shows tool name only, no buttons, no timer.
 * Approve/Deny buttons are in PermissionResponseInput (replaces chat input).
 * Border color indicates state: orange(pending), green(approved), red(denied).
 */
export function ApprovalCard({ toolName, status }: ApprovalCardProps) {
	const borderColorMap: Record<string, string> = {
		pending_approval: "border-accent border-2 bg-secondary",
		denied: "border-destructive bg-destructive/10",
		timed_out: "border-border bg-secondary",
	};
	const borderColor = borderColorMap[status] ?? "";

	if (
		status !== "pending_approval" &&
		status !== "denied" &&
		status !== "timed_out"
	) {
		return null;
	}

	return (
		<div className={cn("mt-2 rounded-md p-4", borderColor)}>
			<div className="flex items-center gap-2 text-sm">
				<ShieldCheck className="h-4 w-4 text-accent" />
				<span className="font-semibold text-primary-foreground">
					{toolName}
				</span>
				{status === "pending_approval" && (
					<span className="text-xs text-muted">Awaiting approval</span>
				)}
				{status === "denied" && (
					<span className="text-xs font-medium text-destructive">Denied</span>
				)}
				{status === "timed_out" && (
					<span className="text-xs font-medium text-muted">Timed out</span>
				)}
			</div>
		</div>
	);
}
