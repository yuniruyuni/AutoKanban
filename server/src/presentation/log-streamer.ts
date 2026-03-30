import type { LogStoreSubscription } from "../models/common";
import { createServiceCtx } from "../repositories/common";
import type { ILogger } from "../types/logger";
import type {
	ExecutorRepository,
	LogStore,
	LogStoreManager,
} from "../repositories";

export type { LogEntry } from "../models/common";

export interface ILogStreamer {
	createSSEStream(executionProcessId: string): ReadableStream<string>;
	stop(executionProcessId: string): boolean;
}

/**
 * Streams logs from running processes via SSE.
 * Uses LogStoreManager which buffers logs from process start,
 * so late SSE connections receive all history plus live updates.
 *
 * This is a Presentation layer component — it handles the SSE response format.
 */
export class LogStreamer implements ILogStreamer {
	private activeSubscriptions = new Map<string, LogStoreSubscription>();
	private logger: ILogger;

	constructor(
		private executor: ExecutorRepository,
		private logStoreManager: LogStoreManager,
		logger: ILogger,
	) {
		this.logger = logger.child("LogStreamer");
	}

	/**
	 * Stops streaming logs for a process.
	 */
	stop(executionProcessId: string): boolean {
		const subscription = this.activeSubscriptions.get(executionProcessId);
		if (subscription) {
			subscription.unsubscribe();
			this.activeSubscriptions.delete(executionProcessId);
			return true;
		}
		return false;
	}

	/**
	 * Creates a ReadableStream for SSE log streaming.
	 * Uses LogStoreManager to provide history + live updates.
	 */
	createSSEStream(executionProcessId: string): ReadableStream<string> {
		const svcCtx = createServiceCtx();
		// Get or check for log store
		const store = this.logStoreManager.get(svcCtx, executionProcessId);
		const runningProcess = this.executor.get(svcCtx, executionProcessId);

		// If no store and no process, return empty stream with error
		if (!store && !runningProcess) {
			return new ReadableStream<string>({
				start: (controller) => {
					controller.enqueue(
						'data: {"type":"error","message":"Process not found"}\n\n',
					);
					controller.close();
				},
			});
		}

		// Check if there's already an active subscription for this process
		if (this.activeSubscriptions.has(executionProcessId)) {
			// Clean up old subscription
			const old = this.activeSubscriptions.get(executionProcessId);
			old?.unsubscribe();
		}

		// If we have a store, subscribe to it
		if (store) {
			return this.createStoreBasedStream(executionProcessId, store);
		}

		// Fallback: wait for store to be created
		return new ReadableStream<string>({
			start: (controller) => {
				controller.enqueue(
					'data: {"type":"info","message":"Waiting for process to start logging..."}\n\n',
				);

				// Poll for store creation
				const checkInterval = setInterval(() => {
					const newStore = this.logStoreManager.get(svcCtx, executionProcessId);
					if (newStore) {
						clearInterval(checkInterval);
						// Subscribe and forward entries
						const subscription = newStore.subscribe(svcCtx);
						this.activeSubscriptions.set(executionProcessId, subscription);
						this.forwardEntries(executionProcessId, subscription, controller);
					}
				}, 100);

				// Timeout after 30 seconds
				setTimeout(() => {
					clearInterval(checkInterval);
					if (!this.logStoreManager.get(svcCtx, executionProcessId)) {
						controller.enqueue(
							'data: {"type":"error","message":"Timeout waiting for process"}\n\n',
						);
						controller.close();
					}
				}, 30000);
			},
			cancel: () => {
				this.stop(executionProcessId);
			},
		});
	}

	/**
	 * Creates an SSE stream backed by a LogStore.
	 */
	private createStoreBasedStream(
		executionProcessId: string,
		store: LogStore,
	): ReadableStream<string> {
		const svcCtx = createServiceCtx();
		return new ReadableStream<string>({
			start: (controller) => {
				const subscription = store.subscribe(svcCtx);
				this.activeSubscriptions.set(executionProcessId, subscription);
				this.forwardEntries(executionProcessId, subscription, controller);
			},
			cancel: () => {
				this.stop(executionProcessId);
			},
		});
	}

	/**
	 * Forwards entries from subscription to SSE controller.
	 */
	private async forwardEntries(
		executionProcessId: string,
		subscription: LogStoreSubscription,
		controller: ReadableStreamDefaultController<string>,
	): Promise<void> {
		try {
			for await (const entry of subscription.stream) {
				const sseEvent = `data: ${JSON.stringify(entry)}\n\n`;
				controller.enqueue(sseEvent);
			}
			controller.enqueue('data: {"type":"end"}\n\n');
			controller.close();
		} catch (error) {
			this.logger.error("Error forwarding entries:", error);
			const message = error instanceof Error ? error.message : "Unknown error";
			controller.enqueue(`data: {"type":"error","message":"${message}"}\n\n`);
			controller.close();
		} finally {
			this.activeSubscriptions.delete(executionProcessId);
		}
	}
}
