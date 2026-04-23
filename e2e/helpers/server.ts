import { join } from "node:path";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { startup } from "../../server/src/presentation/system/routers/startup";
import { trpcServer } from "../../server/src/presentation/trpc/adapter";
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
	const db = await createTestDB({
		dataDir: join(import.meta.dir, "../.test-pg-data"),
	});
	const logger = createMockLogger();
	const currentCtx = await createE2EContext(db, logger);
	ctx = currentCtx;

	await startup(currentCtx);

	const app = new Hono();
	app.use("/*", cors());
	app.use(
		"/trpc/*",
		trpcServer<typeof appRouter>({
			router: appRouter,
			createContext: () => currentCtx,
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
	return { port, ctx: currentCtx };
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
