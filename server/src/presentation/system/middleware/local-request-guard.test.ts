import { describe, expect, test } from "bun:test";
import { Hono } from "hono";
import {
	localRequestGuard,
	localRequestGuardOptionsFromEnv,
} from "./local-request-guard";

const PORT = 3000;

function createApp(env: Record<string, string | undefined> = {}) {
	const app = new Hono();
	app.use("*", localRequestGuard(localRequestGuardOptionsFromEnv(PORT, env)));
	app.get("/health", (c) => c.json({ status: "ok" }));
	app.post("/trpc/tool.execute", (c) => c.json({ executed: true }));
	return app;
}

function req(
	path: string,
	init: { method?: string; headers?: Record<string, string> } = {},
) {
	return new Request(`http://127.0.0.1:${PORT}${path}`, {
		method: init.method ?? "GET",
		headers: { host: `127.0.0.1:${PORT}`, ...init.headers },
		body: init.method === "POST" ? "{}" : undefined,
	});
}

describe("localRequestGuard", () => {
	describe("Host header", () => {
		test.each([
			`127.0.0.1:${PORT}`,
			`localhost:${PORT}`,
			`[::1]:${PORT}`,
			`LOCALHOST:${PORT}`,
		])("allows loopback host %s", async (host) => {
			const res = await createApp().fetch(
				req("/health", { headers: { host } }),
			);
			expect(res.status).toBe(200);
		});

		test.each([
			`attacker.example:${PORT}`,
			"attacker.example",
			`192.168.1.10:${PORT}`,
			"localhost:9999",
			"localhost",
		])("rejects host %s (DNS rebinding / LAN)", async (host) => {
			const res = await createApp().fetch(
				req("/health", { headers: { host } }),
			);
			expect(res.status).toBe(421);
		});

		test("rejects mutation with rebinding host", async () => {
			const res = await createApp().fetch(
				req("/trpc/tool.execute", {
					method: "POST",
					headers: { host: `rebind.attacker.example:${PORT}` },
				}),
			);
			expect(res.status).toBe(421);
		});

		test("AUTO_KANBAN_ALLOWED_HOSTS adds extra hosts", async () => {
			const app = createApp({ AUTO_KANBAN_ALLOWED_HOSTS: "my-box.lan:3000" });
			const res = await app.fetch(
				req("/health", { headers: { host: "my-box.lan:3000" } }),
			);
			expect(res.status).toBe(200);
		});
	});

	describe("Origin header", () => {
		test("allows non-browser client without Origin (MCP subprocess)", async () => {
			const res = await createApp().fetch(
				req("/trpc/tool.execute", {
					method: "POST",
					headers: { "content-type": "application/json" },
				}),
			);
			expect(res.status).toBe(200);
		});

		test.each([
			"http://localhost:5173",
			"http://127.0.0.1:5173",
			"http://localhost:4173",
			`http://localhost:${PORT}`,
			`http://127.0.0.1:${PORT}`,
			`http://[::1]:${PORT}`,
		])("allows same-origin UI POST from %s", async (origin) => {
			const res = await createApp().fetch(
				req("/trpc/tool.execute", {
					method: "POST",
					headers: { origin, "sec-fetch-site": "same-origin" },
				}),
			);
			expect(res.status).toBe(200);
		});

		test.each([
			"https://evil.example",
			"http://localhost:8080",
			"http://192.168.1.10:5173",
			"https://localhost:5173",
			"null",
		])("rejects cross-origin POST from %s", async (origin) => {
			const res = await createApp().fetch(
				req("/trpc/tool.execute", { method: "POST", headers: { origin } }),
			);
			expect(res.status).toBe(403);
		});

		test("rejects cross-origin GET too", async () => {
			const res = await createApp().fetch(
				req("/health", { headers: { origin: "https://evil.example" } }),
			);
			expect(res.status).toBe(403);
		});

		test("rejects cross-origin WebSocket upgrade", async () => {
			const res = await createApp().fetch(
				req("/health", {
					headers: {
						origin: "https://evil.example",
						upgrade: "websocket",
						connection: "Upgrade",
					},
				}),
			);
			expect(res.status).toBe(403);
		});

		test("rejects Sec-Fetch-Site: cross-site even without Origin", async () => {
			const res = await createApp().fetch(
				req("/trpc/tool.execute", {
					method: "POST",
					headers: { "sec-fetch-site": "cross-site" },
				}),
			);
			expect(res.status).toBe(403);
		});

		test("VITE_PORT controls the allowed dev UI origin", async () => {
			const app = createApp({ VITE_PORT: "40001" });
			const ok = await app.fetch(
				req("/trpc/tool.execute", {
					method: "POST",
					headers: { origin: "http://localhost:40001" },
				}),
			);
			expect(ok.status).toBe(200);
			const ng = await app.fetch(
				req("/trpc/tool.execute", {
					method: "POST",
					headers: { origin: "http://localhost:5173" },
				}),
			);
			expect(ng.status).toBe(403);
		});

		test("AUTO_KANBAN_ALLOWED_ORIGINS adds extra origins", async () => {
			const app = createApp({
				AUTO_KANBAN_ALLOWED_ORIGINS: "http://my-box.lan:5173",
			});
			const res = await app.fetch(
				req("/trpc/tool.execute", {
					method: "POST",
					headers: { origin: "http://my-box.lan:5173" },
				}),
			);
			expect(res.status).toBe(200);
		});
	});

	test("does not emit CORS headers", async () => {
		const res = await createApp().fetch(
			req("/health", { headers: { origin: "http://localhost:5173" } }),
		);
		expect(res.headers.get("access-control-allow-origin")).toBeNull();
	});
});
