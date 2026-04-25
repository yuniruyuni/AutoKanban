import type { ServiceCtx } from "../common";

/**
 * Per-process HTTP (and eventually WebSocket) pass-through proxy.
 *
 * Each active DevServerProcess owns a dedicated AutoKanban-side port
 * (`DevServerProcess.proxyPort`). The viewer's browser talks to
 * `<autokanban-host>:<proxyPort>` and the proxy forwards every request to
 * whatever URL the project's dev server emits on stdout. This lets the
 * `auto-kanban.json` `server` script pick any URL reachable from the
 * AutoKanban process (e.g. `http://localhost:<random>`) without caring
 * about the viewer's network — AutoKanban's own port is the single source
 * of external reachability.
 *
 * Lifecycle:
 *   1. `start(processId, preferredPort?)` opens a listener. Before a target
 *      URL is known the proxy serves a small "preview server is warming up"
 *      placeholder so the iframe stays framed at the right origin and can
 *      auto-refresh. `preferredPort` is a hint — if the bind races
 *      EADDRINUSE the implementation acquires a fresh free port and binds
 *      there. The actual bound port is returned so the caller can reconcile
 *      its DB row.
 *   2. `setTarget(processId, url)` makes subsequent requests forward to
 *      `url`. Typically invoked from a log watcher that detected the dev
 *      server's emitted URL.
 *   3. `stop(processId)` closes the listener when the dev server exits.
 */
export interface PreviewProxyRepository {
	start(
		ctx: ServiceCtx,
		processId: string,
		preferredPort?: number,
	): Promise<{ port: number }>;
	setTarget(ctx: ServiceCtx, processId: string, targetUrl: string): void;
	stop(ctx: ServiceCtx, processId: string): boolean;
	/** Returns the current target URL, or null if not set. Test helper. */
	getTarget(ctx: ServiceCtx, processId: string): string | null;
}
