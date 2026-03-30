/**
 * Tool Status State Machine
 *
 * Pure functions for computing tool status transitions.
 * The state machine governs: running → pending_approval → running/denied,
 * and running → success/failed on tool_result.
 */

import type { PlanStatus, ToolStatus } from "../../types/conversation";

/** Input shape for control_response normalization */
export interface ControlResponseInput {
	subtype: string;
	approved?: boolean;
	reason?: string;
	response?: { behavior?: string; message?: string };
}

/** Normalized approval decision */
export interface NormalizedApproval {
	approved: boolean;
	reason?: string;
}

/** Result of applying a control_response to a tool */
export interface ControlResponseResult {
	newStatus: ToolStatus;
	planStatusUpdate?: PlanStatus;
	feedbackReason?: string;
}

const APPROVAL_SUBTYPES = new Set([
	"permission_request",
	"canUseTool",
	"can_use_tool",
]);

/**
 * Determine if a control_request subtype triggers a pending_approval transition.
 * Returns "pending_approval" if valid, null otherwise.
 */
export function applyControlRequest(
	subtype: string,
): "pending_approval" | null {
	return APPROVAL_SUBTYPES.has(subtype) ? "pending_approval" : null;
}

/**
 * Normalize legacy and new control_response formats into a common shape.
 * Returns null if the response format is unrecognized.
 */
export function normalizeControlResponse(
	response: ControlResponseInput,
): NormalizedApproval | null {
	if (response.subtype === "permission_response") {
		// Legacy format: { subtype: "permission_response", approved, reason }
		if (response.approved === undefined) return null;
		return { approved: response.approved, reason: response.reason };
	}
	if (response.subtype === "success") {
		// New format: { subtype: "success", response: { behavior: "allow"|"deny", message } }
		if (!response.response?.behavior) return null;
		return {
			approved: response.response.behavior === "allow",
			reason: response.response.message,
		};
	}
	return null;
}

/**
 * Compute the tool status transition after a control_response.
 */
export function applyControlResponse(
	approved: boolean,
	reason: string | undefined,
	toolName: string,
	actionType: string,
): ControlResponseResult {
	if (approved) {
		const result: ControlResponseResult = { newStatus: "running" };
		if (toolName === "ExitPlanMode" && actionType === "plan") {
			result.planStatusUpdate = "approved";
		}
		return result;
	}

	const result: ControlResponseResult = { newStatus: "denied" };
	if (toolName === "ExitPlanMode" && actionType === "plan") {
		result.planStatusUpdate = "rejected";
	}
	if (reason) {
		result.feedbackReason = reason;
	}
	return result;
}

/**
 * Compute the tool status from a tool_result.
 */
export function applyToolResult(isError: boolean): ToolStatus {
	return isError ? "failed" : "success";
}
