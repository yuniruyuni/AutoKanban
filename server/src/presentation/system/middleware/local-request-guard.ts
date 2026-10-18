import type { MiddlewareHandler } from "hono";

/**
 * Loopback request guard.
 *
 * AutoKanban has no authentication and exposes procedures that spawn
 * processes (tool.execute, agentSetting.update, ...). Binding 127.0.0.1 alone
 * does not stop a web page in the user's browser from reaching the API:
 *
 * - **Cross-origin requests**: any site can `fetch("http://127.0.0.1:3000/trpc/...")`.
 *   Even without CORS the request itself is delivered and executed; only the
 *   response is hidden. So we reject requests whose `Origin` is not one of the
 *   AutoKanban UI origins, and requests the browser marks `Sec-Fetch-Site: cross-site`.
 * - **DNS rebinding**: `attacker.example` re-resolved to 127.0.0.1 becomes
 *   "same-origin" from the browser's point of view, but the `Host` header still
 *   says `attacker.example`. So we only accept loopback `Host` values.
 *
 * Non-browser clients (the `--mcp` subprocess's TrpcHttpClient, curl) send no
 * `Origin` / `Sec-Fetch-Site` and a loopback `Host`, so they pass unchanged.
 */

const LOOPBACK_HOSTNAMES = ["localhost", "127.0.0.1", "[::1]"];

/** Vite `preview` default port (`client` `start:prod`). */
const VITE_PREVIEW_DEFAULT_PORT = 4173;
const VITE_DEV_DEFAULT_PORT = 5173;

export interface LocalRequestGuardOptions {
	/** Port the AutoKanban HTTP server listens on. */
	serverPort: number;
	/** Ports the client UI (Vite dev / preview) is served from. */
	uiPorts: number[];
	/** Extra `host[:port]` values to accept in the Host header (lowercase). */
	extraHosts?: string[];
	/** Extra exact origins (`scheme://host[:port]`) to accept. */
	extraOrigins?: string[];
}

export type GuardDecision =
	| { ok: true }
	| { ok: false; status: 403 | 421; reason: string };

function parseList(raw: string | undefined): string[] {
	if (!raw) return [];
	return raw
		.split(",")
		.map((s) => s.trim().toLowerCase())
		.filter((s) => s.length > 0);
}

function parsePort(raw: string | undefined): number | undefined {
	if (!raw) return undefined;
	const n = Number(raw);
	return Number.isInteger(n) && n > 0 && n < 65536 ? n : undefined;
}

/**
 * Build guard options from the server port and environment.
 *
 * - `VITE_PORT` (default 5173): Vite dev server, which proxies /trpc and /sse.
 * - 4173: Vite preview (`start:prod`), same proxy config.
 * - `AUTO_KANBAN_ALLOWED_HOSTS` / `AUTO_KANBAN_ALLOWED_ORIGINS`: comma-separated
 *   escape hatches for users who deliberately widen the trust boundary
 *   (e.g. together with `AUTO_KANBAN_HOST`).
 */
export function localRequestGuardOptionsFromEnv(
	serverPort: number,
	env: Record<string, string | undefined> = process.env,
): LocalRequestGuardOptions {
	const vitePort = parsePort(env.VITE_PORT) ?? VITE_DEV_DEFAULT_PORT;
	return {
		serverPort,
		uiPorts: [vitePort, VITE_PREVIEW_DEFAULT_PORT],
		extraHosts: parseList(env.AUTO_KANBAN_ALLOWED_HOSTS),
		extraOrigins: parseList(env.AUTO_KANBAN_ALLOWED_ORIGINS),
	};
}

function hostsFor(port: number): string[] {
	const hosts = LOOPBACK_HOSTNAMES.map((h) => `${h}:${port}`);
	// Browsers omit the default port from Host / Origin.
	if (port === 80) hosts.push(...LOOPBACK_HOSTNAMES);
	return hosts;
}

export function allowedHosts(opts: LocalRequestGuardOptions): Set<string> {
	return new Set([...hostsFor(opts.serverPort), ...(opts.extraHosts ?? [])]);
}

export function allowedOrigins(opts: LocalRequestGuardOptions): Set<string> {
	const origins = new Set<string>(opts.extraOrigins ?? []);
	for (const port of [opts.serverPort, ...opts.uiPorts]) {
		for (const host of hostsFor(port)) origins.add(`http://${host}`);
	}
	return origins;
}

/**
 * Pure decision function, separated from Hono for testing.
 */
export function checkLocalRequest(
	headers: Headers,
	hosts: Set<string>,
	origins: Set<string>,
): GuardDecision {
	const host = headers.get("host")?.trim().toLowerCase();
	if (!host || !hosts.has(host)) {
		return {
			ok: false,
			status: 421,
			reason: "Host not allowed",
		};
	}

	const origin = headers.get("origin")?.trim().toLowerCase();
	// "null" origin (sandboxed iframe, file://, some redirects) is never ours.
	if (origin !== undefined && !origins.has(origin)) {
		return { ok: false, status: 403, reason: "Origin not allowed" };
	}

	if (headers.get("sec-fetch-site")?.toLowerCase() === "cross-site") {
		return { ok: false, status: 403, reason: "Cross-site request rejected" };
	}

	return { ok: true };
}

// @specre 01KPQ6W85T6VTJEQWKM3BNVPMC
export function localRequestGuard(
	opts: LocalRequestGuardOptions,
): MiddlewareHandler {
	const hosts = allowedHosts(opts);
	const origins = allowedOrigins(opts);
	return async (c, next) => {
		const decision = checkLocalRequest(c.req.raw.headers, hosts, origins);
		if (!decision.ok) {
			return c.text(decision.reason, decision.status);
		}
		await next();
	};
}
