import type { ServiceCtx } from "../../types/db-capability";

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

export interface MessageQueueRepository {
	queue(
		ctx: ServiceCtx,
		sessionId: string,
		prompt: string,
		executor?: string,
		variant?: string,
	): QueuedMessage;
	get(ctx: ServiceCtx, sessionId: string): QueuedMessage | undefined;
	getStatus(ctx: ServiceCtx, sessionId: string): QueueStatus;
	consume(ctx: ServiceCtx, sessionId: string): QueuedMessage | undefined;
	cancel(ctx: ServiceCtx, sessionId: string): boolean;
	has(ctx: ServiceCtx, sessionId: string): boolean;
	clear(ctx: ServiceCtx): void;
}
