import type { QueuedMessage, QueueStatus } from "../../models/message-queue";
import type { ServiceCtx } from "../common";

export type { QueuedMessage, QueueStatus } from "../../models/message-queue";

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
