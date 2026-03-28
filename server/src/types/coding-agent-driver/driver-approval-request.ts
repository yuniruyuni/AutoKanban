/**
 * Generic approval request emitted by the driver.
 * The orchestrator creates an Approval record and waits for user response,
 * then calls driver.respondToApproval() with the same request object.
 */
export interface DriverApprovalRequest {
	toolName: string;
	toolCallId: string;
	toolInput: Record<string, unknown>;
	/**
	 * Opaque protocol-specific data the driver needs to construct its response.
	 * The orchestrator never inspects this — it passes it back unchanged
	 * to respondToApproval().
	 */
	protocolContext: unknown;
}
