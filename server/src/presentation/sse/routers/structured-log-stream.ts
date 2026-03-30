import type { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import type { Context } from "../../../usecases/context";
import { StructuredLogStreamer } from "../structured-log-streamer";

export function registerStructuredLogStreamRoute(
	app: Hono,
	ctx: Context,
): void {
	app.get("/sse/structured-logs/:executionProcessId", async (c) => {
		const executionProcessId = c.req.param("executionProcessId");
		const streamer = new StructuredLogStreamer(
			ctx.repos.executionProcessLogs,
		);

		return streamSSE(c, async (stream) => {
			const controller = new AbortController();
			stream.onAbort(() => controller.abort());

			for await (const event of streamer.stream(
				executionProcessId,
				controller.signal,
			)) {
				await stream.writeSSE({
					event: event.type,
					data: JSON.stringify(event.data),
				});
			}
		});
	});
}
