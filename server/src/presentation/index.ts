import { trpcServer } from "@hono/trpc-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { closeDatabase } from "../infra/db";
import { removePortFile, writePortFile } from "../infra/port-file";
import type { Context } from "../usecases/context";
import { runMcpServer } from "./mcp/stdio";
import { sseRoutes } from "./sse/routers";
import { sseServer } from "./sse/stream";
import { registerHealthRoute } from "./system/routers/health";
import { startup } from "./system/routers/startup";
import { appRouter } from "./trpc/routers";

export type { AppRouter } from "./trpc/routers";

export type ServerMode = "main" | "mcp";

type StartServerParams = { mode: "main"; ctx: Context } | { mode: "mcp" };

export async function startServer(params: StartServerParams) {
	if (params.mode === "mcp") {
		await runMcpServer();
		return;
	}

	const { ctx } = params;

	// System startup (recovery, seeds)
	await startup(ctx);

	// HTTP server
	const PORT = Number(process.env.PORT ?? 3000);
	// Default to loopback: AutoKanban has no auth and trusts the OS user boundary.
	// Binding 0.0.0.0 exposes the full API to any device on the LAN.
	// AUTO_KANBAN_HOST escape hatch is for WSL/container users who intentionally
	// forward from an outer host and accept the trust implications themselves.
	const HOST = process.env.AUTO_KANBAN_HOST ?? "127.0.0.1";
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

	// System routes
	registerHealthRoute(app);

	// SSE protocol
	app.use("/sse/*", sseServer({ routes: sseRoutes, ctx }));

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

	ctx.logger.info(`Server running on http://${HOST}:${PORT}`);

	return {
		hostname: HOST,
		port: PORT,
		fetch: app.fetch,
		idleTimeout: 120,
	};
}
