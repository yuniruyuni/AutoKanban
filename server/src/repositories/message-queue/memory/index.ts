import type { ServiceCtx } from "../../common";
import type {
	MessageQueueRepository as MessageQueueRepositoryDef,
	QueuedMessage,
	QueueStatus,
} from "../repository";

export class MessageQueueRepository implements MessageQueueRepositoryDef {
	private queues: Map<string, QueuedMessage> = new Map();

	queue(
		_ctx: ServiceCtx,
		sessionId: string,
		prompt: string,
		executor?: string,
		variant?: string,
	): QueuedMessage {
		const message: QueuedMessage = {
			sessionId,
			prompt,
			executor,
			variant,
			queuedAt: new Date(),
		};
		this.queues.set(sessionId, message);
		return message;
	}

	get(_ctx: ServiceCtx, sessionId: string): QueuedMessage | undefined {
		return this.queues.get(sessionId);
	}

	getStatus(_ctx: ServiceCtx, sessionId: string): QueueStatus {
		const message = this.queues.get(sessionId);
		return { hasMessage: !!message, message };
	}

	consume(_ctx: ServiceCtx, sessionId: string): QueuedMessage | undefined {
		const message = this.queues.get(sessionId);
		if (message) this.queues.delete(sessionId);
		return message;
	}

	cancel(_ctx: ServiceCtx, sessionId: string): boolean {
		return this.queues.delete(sessionId);
	}

	has(_ctx: ServiceCtx, sessionId: string): boolean {
		return this.queues.has(sessionId);
	}

	clear(_ctx: ServiceCtx): void {
		this.queues.clear();
	}
}

export const messageQueueRepository = new MessageQueueRepository();
