import type { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import type { Context } from "../../../usecases/context";

export function registerLogStreamRoute(app: Hono, ctx: Context): void {
	app.get("/sse/logs/:executionProcessId", async (c) => {
		const executionProcessId = c.req.param("executionProcessId");

		return streamSSE(c, async (stream) => {
			const sseStream = ctx.logStreamer.createSSEStream(executionProcessId);
			const reader = sseStream.getReader();

			try {
				while (true) {
					const { done, value } = await reader.read();
					if (done) break;

					const lines = value.split("\n");
					for (const line of lines) {
						if (line.startsWith("data: ")) {
							const data = line.slice(6);
							await stream.writeSSE({ data });
						}
					}
				}
			} finally {
				reader.releaseLock();
			}
		});
	});
}
