import type { ILogger } from "../../../infra/logger/types";
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

	start(_ctx: ServiceCtx, processId: string, port: number): void {
		if (this.running.has(processId)) {
			this.logger.warn(
				`Proxy for ${processId} already running, ignoring start()`,
			);
			return;
		}

		const self = this;
		const server = Bun.serve({
			port,
			hostname: "0.0.0.0",
			async fetch(req: Request) {
				const entry = self.running.get(processId);
				if (!entry || !entry.target) {
					return warmingUpResponse();
				}
				return self.forward(req, entry.target, processId);
			},
		});

		this.running.set(processId, { server, port, target: null });
		this.logger.info(
			`Preview proxy for ${processId} listening on 0.0.0.0:${port}`,
		);
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
