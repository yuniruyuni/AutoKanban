import { createServiceCtx, type Full } from "../common";
import type { ILogger } from "../../types/logger";
import type { ExecutionProcessLogsRepository } from "../../types/repository";
import { type LogStore, logStoreManager } from "../log-store";

/**
 * Collects logs from print mode (legacy) process streams.
 * Reads stdout/stderr and persists to both in-memory store and database.
 */
export class LogCollector {
	constructor(
		private executionProcessLogsRepo: Full<ExecutionProcessLogsRepository>,
		private logger: ILogger,
	) {}

	/**
	 * Starts collecting logs from stdout/stderr.
	 * Ensures no data is lost before SSE connection is made.
	 */
	collect(
		processId: string,
		stdout: ReadableStream<Uint8Array>,
		stderr: ReadableStream<Uint8Array>,
	): void {
		const svcCtx = createServiceCtx();
		const store = logStoreManager.create(svcCtx, processId);
		this.collectStream(processId, stdout, "stdout", store);
		this.collectStream(processId, stderr, "stderr", store);
	}

	/**
	 * Collects data from a stream and writes to the log store.
	 */
	private async collectStream(
		processId: string,
		stream: ReadableStream<Uint8Array>,
		source: "stdout" | "stderr",
		store: LogStore,
	): Promise<void> {
		const reader = stream.getReader();
		const decoder = new TextDecoder();
		const svcCtx = createServiceCtx();

		try {
			while (true) {
				const { done, value } = await reader.read();
				if (done) break;

				const data = decoder.decode(value, { stream: true });

				const entry = {
					timestamp: new Date(),
					source,
					data,
				};

				store.append(svcCtx, entry);

				// Also persist to database (with newline for proper parsing)
				this.executionProcessLogsRepo.appendLogs(
					processId,
					`[${entry.timestamp.toISOString()}] [${source}] ${data}\n`,
				);
			}
		} catch (error) {
			this.logger.error(`Error collecting ${source}:`, error);
		} finally {
			reader.releaseLock();
		}
	}
}
