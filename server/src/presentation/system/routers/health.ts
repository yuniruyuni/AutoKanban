import type { Hono } from "hono";

export function registerHealthRoute(app: Hono): void {
	app.get("/health", (c) => c.json({ status: "ok" }));
}
