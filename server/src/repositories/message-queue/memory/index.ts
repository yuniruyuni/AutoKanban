import type {
	IMessageQueueRepository,
	QueueStatus,
	QueuedMessage,
} from "../repository";

export class MessageQueueRepository implements IMessageQueueRepository {
	private queues: Map<string, QueuedMessage> = new Map();

	queue(
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

	get(sessionId: string): QueuedMessage | undefined {
		return this.queues.get(sessionId);
	}

	getStatus(sessionId: string): QueueStatus {
		const message = this.queues.get(sessionId);
		return { hasMessage: !!message, message };
	}

	consume(sessionId: string): QueuedMessage | undefined {
		const message = this.queues.get(sessionId);
		if (message) this.queues.delete(sessionId);
		return message;
	}

	cancel(sessionId: string): boolean {
		return this.queues.delete(sessionId);
	}

	has(sessionId: string): boolean {
		return this.queues.has(sessionId);
	}

	clear(): void {
		this.queues.clear();
	}
}

export const messageQueueRepository = new MessageQueueRepository();
