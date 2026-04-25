import { afterEach, describe, expect, test } from "bun:test";
import { findFreePort } from "../net/find-free-port";
import { TrpcHttpClient } from "./client";

type MiniServer = ReturnType<typeof Bun.serve>;
const openServers: MiniServer[] = [];

afterEach(() => {
	for (const s of openServers.splice(0)) s.stop(true);
});

async function startStallingServer(delayMs: number): Promise<string> {
	const port = await findFreePort();
	const server = Bun.serve({
		port,
		hostname: "127.0.0.1",
		fetch: async (_req) => {
			await new Promise<void>((resolve) => setTimeout(resolve, delayMs));
			return new Response(JSON.stringify({ result: { data: "ok" } }), {
				headers: { "Content-Type": "application/json" },
			});
		},
	});
	openServers.push(server);
	return `http://127.0.0.1:${port}`;
}

async function startFastServer(): Promise<string> {
	const port = await findFreePort();
	const server = Bun.serve({
		port,
		hostname: "127.0.0.1",
		fetch: () =>
			new Response(JSON.stringify({ result: { data: "ok" } }), {
				headers: { "Content-Type": "application/json" },
			}),
	});
	openServers.push(server);
	return `http://127.0.0.1:${port}`;
}

async function captureError(p: Promise<unknown>): Promise<Error> {
	try {
		await p;
	} catch (e) {
		return e as Error;
	}
	throw new Error("expected promise to reject, but it resolved");
}

describe("TrpcHttpClient timeouts", () => {
	test("query rejects with a timeout error when the server stalls", async () => {
		const baseUrl = await startStallingServer(500);
		const client = new TrpcHttpClient(baseUrl, { requestTimeoutMs: 50 });

		const err = await captureError(client.query("hang.endpoint"));
		expect(err.message).toMatch(
			/tRPC query hang\.endpoint timed out after 0\.05s/,
		);
	});

	test("mutation rejects with a timeout error when the server stalls", async () => {
		const baseUrl = await startStallingServer(500);
		const client = new TrpcHttpClient(baseUrl, { requestTimeoutMs: 50 });

		const err = await captureError(client.mutation("hang.endpoint", { x: 1 }));
		expect(err.message).toMatch(
			/tRPC mutation hang\.endpoint timed out after 0\.05s/,
		);
	});

	test("query succeeds when the server responds within the timeout", async () => {
		const baseUrl = await startFastServer();
		const client = new TrpcHttpClient(baseUrl, { requestTimeoutMs: 5000 });

		const result = await client.query<string>("ok.endpoint");
		expect(result).toBe("ok");
	});
});
