/**
 * In-memory log storage with broadcast capability.
 * Stores logs from process start and allows late subscribers to get history + live updates.
 */
import type { LogEntry, LogStoreSubscription } from "../../../models/log-store";
import type { ServiceCtx } from "../../common";
import type {
	LogStore as LogStoreDef,
	LogStoreManager as LogStoreManagerDef,
} from "../repository";

export class LogStore implements LogStoreDef {
	private logs: LogEntry[] = [];
	private subscribers: Set<(entry: LogEntry) => void> = new Set();
	private closed = false;

	/**
	 * Append a log entry. Called by the log collector when data arrives.
	 */
	append(_ctx: ServiceCtx, entry: LogEntry): void {
		if (this.closed) return;
		this.logs.push(entry);
		// Notify all subscribers
		for (const subscriber of this.subscribers) {
			try {
				subscriber(entry);
			} catch {
				// Ignore errors from individual subscribers
			}
		}
	}

	/**
	 * Mark the store as closed (process ended).
	 */
	close(_ctx: ServiceCtx): void {
		this.closed = true;
		this.subscribers.clear();
	}

	/**
	 * Check if the store is closed.
	 */
	isClosed(_ctx: ServiceCtx): boolean {
		return this.closed;
	}

	/**
	 * Get all historical logs.
	 */
	getHistory(_ctx: ServiceCtx): LogEntry[] {
		return [...this.logs];
	}

	/**
	 * Subscribe to the log stream.
	 * Returns history first, then live updates.
	 */
	subscribe(_ctx: ServiceCtx): LogStoreSubscription {
		const self = this;
		let unsubscribed = false;
		let resolveNext: ((value: IteratorResult<LogEntry, void>) => void) | null =
			null;
		const pendingEntries: LogEntry[] = [];

		// Subscriber callback for live updates
		const onEntry = (entry: LogEntry) => {
			if (unsubscribed) return;
			if (resolveNext) {
				resolveNext({ value: entry, done: false });
				resolveNext = null;
			} else {
				pendingEntries.push(entry);
			}
		};

		const unsubscribe = () => {
			unsubscribed = true;
			self.subscribers.delete(onEntry);
			if (resolveNext) {
				resolveNext({ value: undefined, done: true });
				resolveNext = null;
			}
		};

		async function* streamGenerator(): AsyncGenerator<LogEntry, void, unknown> {
			// First, yield all history
			for (const entry of self.logs) {
				if (unsubscribed) return;
				yield entry;
			}

			// If already closed, we're done
			if (self.closed) return;

			// Subscribe for live updates
			self.subscribers.add(onEntry);

			try {
				// Yield live updates
				while (!unsubscribed && !self.closed) {
					// Yield any pending entries first
					while (pendingEntries.length > 0) {
						const entry = pendingEntries.shift();
						if (entry !== undefined) yield entry;
					}

					// Wait for next entry
					if (!unsubscribed && !self.closed) {
						const entry = await new Promise<LogEntry | null>((resolve) => {
							if (self.closed) {
								resolve(null);
								return;
							}
							resolveNext = (result) => {
								if (result.done) {
									resolve(null);
								} else {
									resolve(result.value);
								}
							};
						});

						if (entry === null) break;
						yield entry;
					}
				}
			} finally {
				unsubscribe();
			}
		}

		return {
			stream: streamGenerator(),
			unsubscribe,
		};
	}
}

/**
 * Manages log stores for all processes.
 */
export class LogStoreManager implements LogStoreManagerDef {
	private stores = new Map<string, LogStore>();

	/**
	 * Create a new log store for a process.
	 */
	create(_ctx: ServiceCtx, processId: string): LogStore {
		const store = new LogStore();
		this.stores.set(processId, store);
		return store;
	}

	/**
	 * Get an existing log store.
	 */
	get(_ctx: ServiceCtx, processId: string): LogStore | undefined {
		return this.stores.get(processId);
	}

	/**
	 * Close and remove a log store.
	 */
	close(_ctx: ServiceCtx, processId: string): void {
		const store = this.stores.get(processId);
		if (store) {
			store.close(_ctx);
			// Keep the store for a while so late subscribers can get history
			// Remove after 5 minutes
			setTimeout(
				() => {
					this.stores.delete(processId);
				},
				5 * 60 * 1000,
			);
		}
	}
}

// Singleton instance
export const logStoreManager = new LogStoreManager();
