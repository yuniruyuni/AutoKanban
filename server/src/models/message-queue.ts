export interface QueuedMessage {
	sessionId: string;
	prompt: string;
	executor?: string;
	variant?: string;
	queuedAt: Date;
}

export interface QueueStatus {
	hasMessage: boolean;
	message?: QueuedMessage;
}
