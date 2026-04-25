import type { ILogger } from "../../../infra/logger/types";
import {
	isPortConflictError,
	listenOnFreePort,
} from "../../../infra/net/find-free-port";
import type { ServiceCtx } from "../../common";
import type { PreviewProxyRepository as PreviewProxyRepositoryDef } from "../repository";

type BunServerHandle = ReturnType<typeof Bun.serve>;

interface RunningProxy {
	server: BunServerHandle;
	port: number;
	/** Destination the pass-through forwards to; null until the dev server
	 *  has printed a URL (detected server-side from its log stream). */
	target: string | null;
}

/**
 * Per-WebSocket state carried on the `data` field. When a viewer upgrades
 * to WS we open a matching upstream to the dev server and hold its handle
 * here so `message` / `close` callbacks can forward bidirectionally.
 */
interface WsData {
	processId: string;
	/** Path + query the viewer requested; forwarded 1:1 to the target WS. */
	pathAndQuery: string;
	upstream: WebSocket | null;
	/** Messages received from the browser before the upstream finished
	 *  connecting. Flushed on upstream `open`. Without this a fast HMR
	 *  client that sends its first frame during the upstream handshake
	 *  would drop it. */
	pending: (string | Buffer | Uint8Array)[];
}

/**
 * Headers that MUST NOT be forwarded hop-by-hop per RFC 7230 §6.1.
 * `content-length` is also dropped because `fetch` recomputes it from the
 * body stream; forwarding the original would mislead the destination if
 * the body has been transformed along the way.
 */
const HOP_BY_HOP_HEADERS = new Set([
	"connection",
	"keep-alive",
	"proxy-authenticate",
	"proxy-authorization",
	"te",
	"trailer",
	"transfer-encoding",
	"upgrade",
	"content-length",
]);

function filterRequestHeaders(headers: Headers): Headers {
	const filtered = new Headers();
	for (const [k, v] of headers) {
		if (HOP_BY_HOP_HEADERS.has(k.toLowerCase())) continue;
		// The viewer's Host header is AutoKanban, not the target — let
		// `fetch` derive the correct Host from the target URL.
		if (k.toLowerCase() === "host") continue;
		filtered.set(k, v);
	}
	return filtered;
}

function filterResponseHeaders(headers: Headers): Headers {
	const filtered = new Headers();
	for (const [k, v] of headers) {
		if (HOP_BY_HOP_HEADERS.has(k.toLowerCase())) continue;
		filtered.set(k, v);
	}
	return filtered;
}

/**
 * Small self-refreshing page shown when the proxy is up but the dev server
 * has not yet printed its URL. Keeps the iframe focused on the proxy origin
 * (so no flicker when the real target starts responding) and polls every
 * second to replace itself with the live content as soon as it is ready.
 */
function warmingUpResponse(): Response {
	const body = `<!doctype html>
<html><head><meta charset="utf-8"><title>Preview starting…</title>
<style>body{font-family:system-ui,sans-serif;color:#71717A;padding:24px}</style>
</head><body>
<p>Preview server is starting — waiting for the dev server to print its URL…</p>
<script>setTimeout(() => location.reload(), 1000)</script>
</body></html>`;
	return new Response(body, {
		status: 503,
		headers: { "content-type": "text/html; charset=utf-8" },
	});
}

export class PreviewProxyRepository implements PreviewProxyRepositoryDef {
	private running = new Map<string, RunningProxy>();
	private logger: ILogger;

	constructor(logger: ILogger) {
		this.logger = logger.child("PreviewProxyRepository");
	}

	async start(
		_ctx: ServiceCtx,
		processId: string,
		preferredPort?: number,
	): Promise<{ port: number }> {
		const existing = this.running.get(processId);
		if (existing) {
			this.logger.warn(
				`Proxy for ${processId} already running on port ${existing.port}, ignoring start()`,
			);
			return { port: existing.port };
		}

		// Caller may pass the port reserved earlier (e.g. stamped on the
		// DevServerProcess row). Try it first; if another listener stole it
		// during the gap, fall back to acquire+bind retry on a fresh port.
		if (preferredPort !== undefined) {
			try {
				const server = this.buildServer(processId, preferredPort);
				this.running.set(processId, {
					server,
					port: preferredPort,
					target: null,
				});
				this.logger.info(
					`Preview proxy for ${processId} listening on 0.0.0.0:${preferredPort}`,
				);
				return { port: preferredPort };
			} catch (err) {
				if (!isPortConflictError(err)) throw err;
				this.logger.warn(
					`Preview proxy ${processId}: preferred port ${preferredPort} taken, falling back to a fresh free port`,
				);
			}
		}

		const { port, result: server } = await listenOnFreePort(
			(candidate) => this.buildServer(processId, candidate),
			{
				attempts: 5,
				logger: this.logger,
				label: `preview proxy ${processId}`,
			},
		);
		this.running.set(processId, { server, port, target: null });
		this.logger.info(
			`Preview proxy for ${processId} listening on 0.0.0.0:${port}`,
		);
		return { port };
	}

	private buildServer(processId: string, port: number): BunServerHandle {
		const self = this;
		return Bun.serve<WsData, never>({
			port,
			hostname: "0.0.0.0",
			async fetch(req: Request, server) {
				const entry = self.running.get(processId);
				if (!entry?.target) {
					return warmingUpResponse();
				}

				// WebSocket upgrade (Vite HMR, Next.js dev overlay, etc). Hand
				// the connection to the `websocket` handler below which will
				// bridge it to the matching target WS.
				if (req.headers.get("upgrade")?.toLowerCase() === "websocket") {
					const url = new URL(req.url);
					const upgraded = server.upgrade(req, {
						data: {
							processId,
							pathAndQuery: url.pathname + url.search,
							upstream: null,
							pending: [],
						} satisfies WsData,
					});
					if (upgraded) return undefined;
					return new Response("Upgrade failed", { status: 400 });
				}

				return self.forward(req, entry.target, processId);
			},
			websocket: {
				open(ws) {
					const entry = self.running.get(ws.data.processId);
					if (!entry?.target) {
						ws.close(1013, "Preview target not ready");
						return;
					}
					const base = entry.target.replace(/^http/, "ws");
					const targetUrl = new URL(ws.data.pathAndQuery, base);
					const upstream = new WebSocket(targetUrl);
					ws.data.upstream = upstream;

					upstream.binaryType = "arraybuffer";
					upstream.addEventListener("open", () => {
						// Closed/closing sockets throw on send. Drop and warn — HMR
						// is idempotent and recovers on the next change.
						for (const m of ws.data.pending) {
							try {
								upstream.send(m);
							} catch (err) {
								self.logger.warn(
									`Failed to flush pending message on ${ws.data.processId}:`,
									err,
								);
								break;
							}
						}
						ws.data.pending.length = 0;
					});
					upstream.addEventListener("message", (ev) => {
						try {
							ws.send(ev.data as string | Buffer | Uint8Array);
						} catch (err) {
							self.logger.warn(
								`Failed to forward upstream message to viewer on ${ws.data.processId}:`,
								err,
							);
						}
					});
					upstream.addEventListener("close", (ev) => {
						ws.close(ev.code, ev.reason);
					});
					upstream.addEventListener("error", (err) => {
						self.logger.warn(
							`WS upstream error on ${ws.data.processId} → ${targetUrl.href}:`,
							err,
						);
						ws.close(1011, "Upstream WS error");
					});
				},
				message(ws, message) {
					const up = ws.data.upstream;
					if (!up) return;
					try {
						if (up.readyState === 1 /* OPEN */) {
							up.send(message);
						} else {
							ws.data.pending.push(message);
						}
					} catch (err) {
						self.logger.warn(
							`Failed to forward viewer message to upstream on ${ws.data.processId}:`,
							err,
						);
					}
				},
				close(ws) {
					ws.data.upstream?.close();
				},
			},
		});
	}

	setTarget(_ctx: ServiceCtx, processId: string, targetUrl: string): void {
		const entry = this.running.get(processId);
		if (!entry) {
			this.logger.warn(
				`setTarget called for unknown proxy ${processId}; ignoring`,
			);
			return;
		}
		entry.target = targetUrl;
		this.logger.info(`Preview proxy ${processId} target set to ${targetUrl}`);
	}

	stop(_ctx: ServiceCtx, processId: string): boolean {
		const entry = this.running.get(processId);
		if (!entry) return false;
		entry.server.stop(true);
		this.running.delete(processId);
		this.logger.info(`Preview proxy ${processId} stopped`);
		return true;
	}

	getTarget(_ctx: ServiceCtx, processId: string): string | null {
		return this.running.get(processId)?.target ?? null;
	}

	/**
	 * Forward a single HTTP request to the target server and stream the
	 * response back to the viewer. Errors contacting the target surface as
	 * a 502 so the iframe reports a recognisable "bad gateway" page — the
	 * alternative (unhandled rejection) would crash the AutoKanban server.
	 */
	private async forward(
		req: Request,
		target: string,
		processId: string,
	): Promise<Response> {
		const incoming = new URL(req.url);
		const outgoing = new URL(target);
		outgoing.pathname = incoming.pathname;
		outgoing.search = incoming.search;

		try {
			const upstream = await fetch(outgoing, {
				method: req.method,
				headers: filterRequestHeaders(req.headers),
				body:
					req.method === "GET" || req.method === "HEAD" ? undefined : req.body,
				redirect: "manual",
			});
			return new Response(upstream.body, {
				status: upstream.status,
				statusText: upstream.statusText,
				headers: filterResponseHeaders(upstream.headers),
			});
		} catch (err) {
			this.logger.error(
				`Preview proxy ${processId} forward to ${outgoing.href} failed:`,
				err,
			);
			return new Response(
				`Preview proxy could not reach ${outgoing.href}: ${err instanceof Error ? err.message : String(err)}`,
				{ status: 502, headers: { "content-type": "text/plain" } },
			);
		}
	}
}
