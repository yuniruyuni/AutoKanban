// @specre 01KPNX4PACA9S29SQDJ441E6V7
export interface PendingPermission {
	requestId: string;
	processId: string;
	sessionId: string;
	toolName: string;
	toolInput: Record<string, unknown>;
	requestedAt: Date;
	timeoutMs: number;
}
