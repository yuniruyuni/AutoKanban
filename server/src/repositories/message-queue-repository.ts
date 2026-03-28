/**
 * MessageQueueRepository - Manages queued follow-up messages for sessions
 *
 * - One message per session at a time (queueing a new message replaces the old one)
 * - Messages are consumed when the agent finishes execution
 * - In-memory storage (not persisted across restarts)
 */

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

export class MessageQueueRepository {
	private queues: Map<string, QueuedMessage> = new Map();

	/**
	 * Queue a message for a session.
	 * If a message already exists for this session, it will be replaced.
	 */
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

	/**
	 * Get the queued message for a session without removing it.
	 */
	get(sessionId: string): QueuedMessage | undefined {
		return this.queues.get(sessionId);
	}

	/**
	 * Get the queue status for a session.
	 */
	getStatus(sessionId: string): QueueStatus {
		const message = this.queues.get(sessionId);
		return {
			hasMessage: !!message,
			message,
		};
	}

	/**
	 * Consume the queued message for a session (get and remove).
	 * Returns the message if one existed, undefined otherwise.
	 */
	consume(sessionId: string): QueuedMessage | undefined {
		const message = this.queues.get(sessionId);
		if (message) {
			this.queues.delete(sessionId);
		}
		return message;
	}

	/**
	 * Cancel/remove the queued message for a session.
	 * Returns true if a message was removed, false if no message existed.
	 */
	cancel(sessionId: string): boolean {
		return this.queues.delete(sessionId);
	}

	/**
	 * Check if a session has a queued message.
	 */
	has(sessionId: string): boolean {
		return this.queues.has(sessionId);
	}

	/**
	 * Clear all queued messages (useful for cleanup/testing).
	 */
	clear(): void {
		this.queues.clear();
	}
}

// Singleton instance
export const messageQueueRepository = new MessageQueueRepository();
