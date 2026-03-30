/**
 * Idle State Computation
 *
 * Pure function to determine Claude's idle state from message type.
 * Claude is idle when awaiting user input (turn completed or permission request).
 */

const APPROVAL_SUBTYPES = new Set([
	"canUseTool",
	"can_use_tool",
	"permission_request",
]);

/**
 * Compute idle state change based on message type.
 *
 * @returns true (now idle), false (now active), or null (no change)
 */
export function computeIdleState(
	messageType: string,
	controlSubtype?: string,
): boolean | null {
	if (messageType === "result") {
		return true;
	}
	if (messageType === "assistant" || messageType === "user") {
		return false;
	}
	if (
		messageType === "control_request" &&
		controlSubtype &&
		APPROVAL_SUBTYPES.has(controlSubtype)
	) {
		return true;
	}
	return null;
}
