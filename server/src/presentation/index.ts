import { trpcServer } from "@hono/trpc-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { closeDatabase } from "../lib/db";
import { removePortFile, writePortFile } from "../lib/port-file";
import type { Context } from "../usecases/context";
import { runMcpServer } from "./mcp/stdio";
import { registerLogStreamRoute } from "./sse/routers/log-stream";
import { registerStructuredLogStreamRoute } from "./sse/routers/structured-log-stream";
import { startup } from "./system/routers/startup";
import { appRouter } from "./trpc/routers";

export type { AppRouter } from "./trpc/routers";

export async function startServer(ctx: Context) {
	// --mcp flag: run as stdio MCP server instead of HTTP server
	if (process.argv.includes("--mcp")) {
		await runMcpServer();
		return;
	}

	// System startup (recovery, seeds)
	await startup(ctx);

	// HTTP server
	const PORT = Number(process.env.PORT ?? 3000);
	const app = new Hono();

	app.use("/*", cors());

	// tRPC protocol
	app.use(
		"/trpc/*",
		trpcServer({
			router: appRouter,
			createContext: () => ctx as unknown as Record<string, unknown>,
		}),
	);

	app.get("/health", (c) => c.json({ status: "ok" }));

	// SSE protocol
	registerLogStreamRoute(app, ctx);
	registerStructuredLogStreamRoute(app, ctx);

	// Port file + shutdown
	writePortFile(PORT);

	async function shutdown() {
		removePortFile();
		await closeDatabase();
		process.exit(0);
	}

	process.on("exit", removePortFile);
	process.on("SIGINT", shutdown);
	process.on("SIGTERM", shutdown);

	ctx.logger.info(`Server running on http://localhost:${PORT}`);

	return {
		hostname: "0.0.0.0",
		port: PORT,
		fetch: app.fetch,
		idleTimeout: 120,
	};
}
