import { useMemo } from "react";
import type {
	ConversationEntry,
	PlanAction,
	ToolEntry,
} from "@/components/chat/types";

interface PlanPendingState {
	isPlanPending: boolean;
	approvalId: string | null;
	executionProcessId: string | null;
}

/**
 * Detects whether there's a pending plan approval from structured entries.
 * Scans entries for ExitPlanMode tools with pending_approval status or
 * plan status 'pending' and extracts the approvalId.
 */
export function usePlanPendingState(
	entries: ConversationEntry[],
	executionProcessId: string | null,
): PlanPendingState {
	return useMemo(() => {
		// Scan from the end for the most recent plan entry
		for (let i = entries.length - 1; i >= 0; i--) {
			const entry = entries[i];
			if (entry.type.kind !== "tool") continue;

			const toolEntry = entry.type as ToolEntry;
			if (toolEntry.action.type !== "plan") continue;

			const planAction = toolEntry.action as PlanAction;

			// Check if plan is pending (either via status or planStatus)
			if (
				toolEntry.status === "pending_approval" ||
				(planAction.planStatus === "pending" && toolEntry.status === "success")
			) {
				return {
					isPlanPending: true,
					approvalId: planAction.approvalId ?? null,
					executionProcessId,
				};
			}

			// If plan is already approved/rejected, no pending state
			if (
				planAction.planStatus === "approved" ||
				planAction.planStatus === "rejected"
			) {
				return {
					isPlanPending: false,
					approvalId: null,
					executionProcessId: null,
				};
			}
		}

		return { isPlanPending: false, approvalId: null, executionProcessId: null };
	}, [entries, executionProcessId]);
}
