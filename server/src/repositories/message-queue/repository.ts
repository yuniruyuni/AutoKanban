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

export interface IMessageQueueRepository {
	queue(
		sessionId: string,
		prompt: string,
		executor?: string,
		variant?: string,
	): QueuedMessage;
	get(sessionId: string): QueuedMessage | undefined;
	getStatus(sessionId: string): QueueStatus;
	consume(sessionId: string): QueuedMessage | undefined;
	cancel(sessionId: string): boolean;
	has(sessionId: string): boolean;
	clear(): void;
}
