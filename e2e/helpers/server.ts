import { trpcServer } from "@hono/trpc-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { startup } from "../../server/src/presentation/system/routers/startup";
import { appRouter } from "../../server/src/presentation/trpc/routers";
import type { Context } from "../../server/src/usecases/context";
import { createTestDB } from "../../server/test/helpers/db";
import { createMockLogger } from "../../server/test/helpers/logger";
import { createE2EContext } from "./context";

let server: {
	port: number | undefined;
	stop: (closeActiveConnections?: boolean) => void;
} | null = null;
let ctx: Context | null = null;

export async function setupTestServer(): Promise<{
	port: number;
	ctx: Context;
}> {
	const db = await createTestDB();
	const logger = createMockLogger();
	ctx = await createE2EContext(db, logger);

	await startup(ctx);

	const app = new Hono();
	app.use("/*", cors());
	app.use(
		"/trpc/*",
		trpcServer({
			router: appRouter,
			createContext: () => ctx as unknown as Record<string, unknown>,
		}),
	);

	server = Bun.serve({
		hostname: "127.0.0.1",
		port: 0,
		fetch: app.fetch,
		idleTimeout: 30,
	});

	const port = server.port;
	if (port === undefined) throw new Error("Server port not assigned");
	return { port, ctx };
}

export async function resetTestData(): Promise<void> {
	// Wait for pending async log writes from previous test to complete
	await Bun.sleep(50);
	await createTestDB(); // TRUNCATEs all tables
	if (ctx) {
		await startup(ctx); // Re-seed defaults
	}
}

export function teardownTestServer(): void {
	if (server) {
		server.stop(true);
		server = null;
	}
}
