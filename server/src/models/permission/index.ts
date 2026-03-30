export interface PendingPermission {
	requestId: string;
	processId: string;
	sessionId: string;
	toolName: string;
	toolInput: Record<string, unknown>;
	requestedAt: Date;
	timeoutMs: number;
}
