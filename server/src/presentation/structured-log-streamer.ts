/**
 * Structured Log Streamer
 *
 * Subscribes to LogStore changes and sends structured conversation entries
 * as SSE events. Only sends deltas (new/updated entries) to minimize bandwidth.
 */

import {
	type ParseResult,
	parseLogsToConversation,
} from "../lib/conversation/conversation-parser";
import type { Full } from "../repositories/common";
import type { ExecutionProcessLogsRepository } from "../repositories";

export interface StructuredLogEvent {
	type: "entry_add" | "entry_update" | "idle_changed" | "snapshot";
	data: unknown;
}

export class StructuredLogStreamer {
	constructor(
		private executionProcessLogsRepo: Full<ExecutionProcessLogsRepository>,
	) {}

	/**
	 * Creates an async generator that yields structured log events as SSE data.
	 * Polls the logs and computes deltas from the previous parse result.
	 */
	async *stream(
		executionProcessId: string,
		signal: AbortSignal,
	): AsyncGenerator<StructuredLogEvent> {
		let prevEntryCount = 0;
		let prevIsIdle = false;
		const sentEntryIds = new Set<string>();

		// Send initial snapshot
		const initial = await this.parseCurrentLogs(executionProcessId);
		if (initial) {
			yield {
				type: "snapshot",
				data: { entries: initial.entries, isIdle: initial.isIdle },
			};
			prevEntryCount = initial.entries.length;
			prevIsIdle = initial.isIdle;
			for (const entry of initial.entries) {
				sentEntryIds.add(entry.id);
			}
		}

		// Poll for changes
		while (!signal.aborted) {
			await new Promise<void>((resolve) => {
				const timer = setTimeout(resolve, 500);
				signal.addEventListener(
					"abort",
					() => {
						clearTimeout(timer);
						resolve();
					},
					{ once: true },
				);
			});

			if (signal.aborted) break;

			const current = await this.parseCurrentLogs(executionProcessId);
			if (!current) continue;

			// Check for new entries
			for (const entry of current.entries) {
				if (!sentEntryIds.has(entry.id)) {
					sentEntryIds.add(entry.id);
					yield { type: "entry_add", data: entry };
				}
			}

			// Check for updated entries (entries whose content may have changed, e.g., tool status)
			if (current.entries.length !== prevEntryCount) {
				// Send updates for the last few entries that may have changed
				const startIdx = Math.max(0, prevEntryCount - 3);
				for (
					let i = startIdx;
					i < Math.min(current.entries.length, prevEntryCount);
					i++
				) {
					yield { type: "entry_update", data: current.entries[i] };
				}
			}

			// Check idle state change
			if (current.isIdle !== prevIsIdle) {
				yield { type: "idle_changed", data: { isIdle: current.isIdle } };
				prevIsIdle = current.isIdle;
			}

			prevEntryCount = current.entries.length;
		}
	}

	private async parseCurrentLogs(
		executionProcessId: string,
	): Promise<ParseResult | null> {
		const logs =
			await this.executionProcessLogsRepo.getLogs(executionProcessId);
		if (!logs?.logs) return null;
		return parseLogsToConversation(logs.logs);
	}
}
