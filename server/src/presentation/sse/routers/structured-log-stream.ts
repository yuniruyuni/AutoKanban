import type { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import type { Context } from "../../../usecases/context";
import {
	getStructuredLogDelta,
	getStructuredLogSnapshot,
} from "../../../usecases/execution/get-structured-log-delta";

export function registerStructuredLogStreamRoute(
	app: Hono,
	ctx: Context,
): void {
	app.get("/sse/structured-logs/:executionProcessId", async (c) => {
		const executionProcessId = c.req.param("executionProcessId");

		return streamSSE(c, async (stream) => {
			const controller = new AbortController();
			stream.onAbort(() => controller.abort());

			// Initial snapshot
			const snapshotResult = await getStructuredLogSnapshot({
				executionProcessId,
			}).run(ctx);
			if (!snapshotResult.ok) return;

			const sentEntryIds = new Set(snapshotResult.value.entryIds);
			let prevEntryCount = snapshotResult.value.entryCount;
			let prevIsIdle = snapshotResult.value.isIdle;

			for (const event of snapshotResult.value.events) {
				await stream.writeSSE({
					event: event.type,
					data: JSON.stringify(event.data),
				});
			}

			// Poll for deltas
			while (!controller.signal.aborted) {
				await new Promise<void>((resolve) => {
					const timer = setTimeout(resolve, 500);
					controller.signal.addEventListener(
						"abort",
						() => {
							clearTimeout(timer);
							resolve();
						},
						{ once: true },
					);
				});

				if (controller.signal.aborted) break;

				const deltaResult = await getStructuredLogDelta({
					executionProcessId,
					sentEntryIds,
					prevEntryCount,
					prevIsIdle,
				}).run(ctx);

				if (!deltaResult.ok) continue;

				const { events, entryCount, isIdle, newEntryIds } = deltaResult.value;

				for (const id of newEntryIds) {
					sentEntryIds.add(id);
				}
				prevEntryCount = entryCount;
				prevIsIdle = isIdle;

				for (const event of events) {
					await stream.writeSSE({
						event: event.type,
						data: JSON.stringify(event.data),
					});
				}
			}
		});
	});
}
