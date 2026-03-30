import { trpcServer } from "@hono/trpc-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { streamSSE } from "hono/streaming";
import { createContext } from "./context";
import { closeDatabase, initDatabase } from "./lib/db";
import { createLogger } from "./lib/logger";
import { removePortFile, writePortFile } from "./lib/port-file";
import { appRouter } from "./presentation";
import { recoverOrphanedProcesses } from "./usecases/setup/recovery";
import { seedDefaultVariants } from "./usecases/setup/seed-variants";
import { seedTaskTemplates } from "./usecases/setup/seed-templates";

// --mcp flag: run as stdio MCP server instead of HTTP server
if (process.argv.includes("--mcp")) {
	const { runMcpServer } = await import("./presentation/mcp/index");
	await runMcpServer();
	// runMcpServer blocks until the parent disconnects — unreachable below
}

const PORT = Number(process.env.PORT ?? 3000);

const logger = createLogger();

const db = await initDatabase();
const ctx = createContext(db, logger);

// Startup usecases — run after context is ready
const recoveredCount = await recoverOrphanedProcesses(ctx);
if (recoveredCount > 0) {
	logger.info(
		`Recovered ${recoveredCount} orphaned process(es) from previous server session`,
	);
}

await seedDefaultVariants().run(ctx);
await seedTaskTemplates().run(ctx);

const app = new Hono();

app.use("/*", cors());

app.use(
	"/trpc/*",
	trpcServer({
		router: appRouter,
		createContext: () => ctx as unknown as Record<string, unknown>,
	}),
);

app.get("/health", (c) => c.json({ status: "ok" }));

// SSE endpoint for structured log streaming
app.get("/sse/structured-logs/:executionProcessId", async (c) => {
	const executionProcessId = c.req.param("executionProcessId");
	const { StructuredLogStreamer } = await import(
		"./presentation/structured-log-streamer"
	);
	const streamer = new StructuredLogStreamer(ctx.repos.executionProcessLogs);

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

// SSE endpoint for log streaming
app.get("/sse/logs/:executionProcessId", async (c) => {
	const executionProcessId = c.req.param("executionProcessId");

	return streamSSE(c, async (stream) => {
		const sseStream = ctx.logStreamer.createSSEStream(executionProcessId);
		const reader = sseStream.getReader();

		try {
			while (true) {
				const { done, value } = await reader.read();
				if (done) break;

				// Parse SSE data and write to stream
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

// Write port file for MCP server discovery
writePortFile(PORT);

async function shutdown() {
	removePortFile();
	await closeDatabase();
	process.exit(0);
}

process.on("exit", removePortFile);
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

logger.info(`Server running on http://localhost:${PORT}`);

export default {
	hostname: "0.0.0.0",
	port: PORT,
	fetch: app.fetch,
	idleTimeout: 120, // 2 minutes idle timeout for SSE connections
};

export type { AppRouter } from "./presentation";
