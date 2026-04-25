import { afterEach, describe, expect, test } from "bun:test";
import { createMockLogger } from "../../../../test/helpers/logger";
import { findFreePort } from "../../../infra/net/find-free-port";
import { createServiceCtx } from "../../common";
import { PreviewProxyRepository } from "./index";

/**
 * Exercises the proxy's lifecycle and pass-through behaviour against a
 * real Bun.serve target. No mocking of the network — we want to catch
 * issues like header stripping, body streaming, and port release.
 */

const ctx = createServiceCtx();

type MiniServer = ReturnType<typeof Bun.serve>;

const openServers: MiniServer[] = [];
const openProxies: PreviewProxyRepository[] = [];

afterEach(() => {
	for (const s of openServers.splice(0)) s.stop(true);
	openProxies.splice(0);
});

async function startTarget(
	handler: (req: Request) => Response | Promise<Response>,
): Promise<{ url: string; server: MiniServer }> {
	const port = await findFreePort();
	const server = Bun.serve({
		port,
		hostname: "127.0.0.1",
		fetch: handler,
	});
	openServers.push(server);
	return { url: `http://127.0.0.1:${port}/`, server };
}

describe("PreviewProxyRepository", () => {
	test("returns a warming-up placeholder before setTarget", async () => {
		const repo = new PreviewProxyRepository(createMockLogger());
		openProxies.push(repo);

		const port = await findFreePort();
		await repo.start(ctx, "p1", port);

		const res = await fetch(`http://127.0.0.1:${port}/`);
		expect(res.status).toBe(503);
		const body = await res.text();
		expect(body).toContain("starting");

		repo.stop(ctx, "p1");
	});

	test("forwards a GET to the configured target once setTarget runs", async () => {
		const target = await startTarget(
			() => new Response("hello-from-target", { status: 200 }),
		);

		const repo = new PreviewProxyRepository(createMockLogger());
		openProxies.push(repo);
		const port = await findFreePort();
		await repo.start(ctx, "p2", port);
		repo.setTarget(ctx, "p2", target.url);

		const res = await fetch(`http://127.0.0.1:${port}/some/path?q=1`);
		expect(res.status).toBe(200);
		expect(await res.text()).toBe("hello-from-target");

		repo.stop(ctx, "p2");
	});

	test("preserves path and query when forwarding", async () => {
		let received = "";
		const target = await startTarget((req) => {
			const u = new URL(req.url);
			received = `${u.pathname}?${u.searchParams.get("q") ?? ""}`;
			return new Response("ok");
		});

		const repo = new PreviewProxyRepository(createMockLogger());
		openProxies.push(repo);
		const port = await findFreePort();
		await repo.start(ctx, "p3", port);
		repo.setTarget(ctx, "p3", target.url);

		await fetch(`http://127.0.0.1:${port}/foo/bar?q=baz`);
		expect(received).toBe("/foo/bar?baz");

		repo.stop(ctx, "p3");
	});

	test("returns 502 when the target is unreachable", async () => {
		const repo = new PreviewProxyRepository(createMockLogger());
		openProxies.push(repo);
		const port = await findFreePort();
		await repo.start(ctx, "p4", port);
		const dead = `http://127.0.0.1:${await findFreePort()}/`;
		repo.setTarget(ctx, "p4", dead);

		const res = await fetch(`http://127.0.0.1:${port}/`);
		expect(res.status).toBe(502);

		repo.stop(ctx, "p4");
	});

	test("stop releases the port (subsequent listen on same port works)", async () => {
		const repo = new PreviewProxyRepository(createMockLogger());
		openProxies.push(repo);
		const port = await findFreePort();
		await repo.start(ctx, "p5", port);
		const stopped = repo.stop(ctx, "p5");
		expect(stopped).toBe(true);

		// We should be able to immediately reuse the port.
		const fresh = Bun.serve({
			port,
			hostname: "127.0.0.1",
			fetch: () => new Response("ok"),
		});
		openServers.push(fresh);
		const res = await fetch(`http://127.0.0.1:${port}/`);
		expect(await res.text()).toBe("ok");
	});

	test("stop on unknown processId returns false", () => {
		const repo = new PreviewProxyRepository(createMockLogger());
		expect(repo.stop(ctx, "never-started")).toBe(false);
	});

	test("falls back to a fresh port when the preferred port is already taken", async () => {
		// Squat on a port to force a real EADDRINUSE on the preferred-port path,
		// proving that previewProxy.start rebinds rather than crashing the caller.
		const squattedPort = await findFreePort();
		const squatter = Bun.serve({
			port: squattedPort,
			hostname: "127.0.0.1",
			fetch: () => new Response("squatter"),
		});
		openServers.push(squatter);

		const repo = new PreviewProxyRepository(createMockLogger());
		openProxies.push(repo);

		const { port: actualPort } = await repo.start(ctx, "race", squattedPort);
		expect(actualPort).not.toBe(squattedPort);
		expect(actualPort).toBeGreaterThan(0);

		// Proxy is reachable on the fallback port; squatter is reachable on the
		// original. Both work, no port collision.
		const placeholder = await fetch(`http://127.0.0.1:${actualPort}/`);
		expect(placeholder.status).toBe(503);
		const squatRes = await fetch(`http://127.0.0.1:${squattedPort}/`);
		expect(await squatRes.text()).toBe("squatter");

		repo.stop(ctx, "race");
	});

	test("acquires its own port when called without a preferred port", async () => {
		const repo = new PreviewProxyRepository(createMockLogger());
		openProxies.push(repo);

		const { port } = await repo.start(ctx, "auto");
		expect(port).toBeGreaterThan(0);

		const res = await fetch(`http://127.0.0.1:${port}/`);
		expect(res.status).toBe(503);
		repo.stop(ctx, "auto");
	});

	test("proxies a WebSocket bidirectionally (HMR path)", async () => {
		// Target WS server that echoes "pong" for "ping".
		const targetPort = await findFreePort();
		const targetServer = Bun.serve<{ label: string }, never>({
			port: targetPort,
			hostname: "127.0.0.1",
			fetch(req, server) {
				if (req.headers.get("upgrade")?.toLowerCase() === "websocket") {
					server.upgrade(req, { data: { label: "target" } });
					return undefined;
				}
				return new Response("n/a");
			},
			websocket: {
				message(ws, message) {
					if (typeof message === "string" && message === "ping") {
						ws.send("pong");
					}
				},
			},
		});
		openServers.push(targetServer);

		const repo = new PreviewProxyRepository(createMockLogger());
		openProxies.push(repo);
		const proxyPort = await findFreePort();
		await repo.start(ctx, "ws-proc", proxyPort);
		repo.setTarget(ctx, "ws-proc", `http://127.0.0.1:${targetPort}/`);

		const ws = new WebSocket(`ws://127.0.0.1:${proxyPort}/hmr`);
		try {
			const received = await new Promise<string>((resolve, reject) => {
				const timeout = setTimeout(
					() => reject(new Error("timeout waiting for pong")),
					2000,
				);
				ws.addEventListener("open", () => ws.send("ping"));
				ws.addEventListener("message", (ev) => {
					clearTimeout(timeout);
					resolve(String(ev.data));
				});
				ws.addEventListener("error", (err) => {
					clearTimeout(timeout);
					reject(err instanceof Error ? err : new Error("ws error"));
				});
			});
			expect(received).toBe("pong");
		} finally {
			ws.close();
			repo.stop(ctx, "ws-proc");
		}
	});
});
