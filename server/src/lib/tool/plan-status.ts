/**
 * Plan Status Detection
 *
 * Pure functions for determining plan approval/rejection status
 * from message text and tool completion state.
 */

import type { PlanStatus, ToolStatus } from "../../types/conversation";

export const PLAN_APPROVAL_PATTERN = "Please proceed with the plan.";
export const PLAN_REJECTION_PATTERN = "I'm rejecting this plan because:";

/**
 * Determine plan status from a user message text.
 * Returns "approved", "rejected", or null if the message is not plan-related.
 */
export function determinePlanStatusFromText(
	text: string,
): "approved" | "rejected" | null {
	if (text === PLAN_APPROVAL_PATTERN) {
		return "approved";
	}
	if (text.startsWith(PLAN_REJECTION_PATTERN)) {
		return "rejected";
	}
	return null;
}

/**
 * Compute the default plan status for a completed plan tool
 * that hasn't been explicitly approved/rejected.
 */
export function computeDefaultPlanStatus(toolStatus: ToolStatus): PlanStatus {
	if (toolStatus === "denied") {
		return "rejected";
	}
	return "pending";
}
