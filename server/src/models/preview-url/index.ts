// @specre 01KPZT8Z802KXZRGTYZKDZVH06
/**
 * Server-side detection of the URL a child dev server prints to stdout.
 *
 * This runs inside AutoKanban, so the detected URL is always interpreted
 * "from the AutoKanban process's perspective" — `localhost:PORT` is fine
 * because AutoKanban and the child live on the same host. The viewer's
 * browser never sees this URL directly; the PreviewProxy forwards to it.
 *
 * Kept intentionally separate from the client-side `detectPreviewUrl`
 * because the client one rewrites hostnames for the browser, which would
 * be wrong when AutoKanban is the consumer.
 */

// biome-ignore lint/suspicious/noControlCharactersInRegex: ANSI escape codes
const ANSI_PATTERN = /\x1b\[[0-9;]*m/g;

const FULL_URL_PATTERN =
	/(https?:\/\/(?:\[[0-9a-f:]+\]|localhost|127\.0\.0\.1|0\.0\.0\.0|\d{1,3}(?:\.\d{1,3}){3})(?::\d{2,5})?(?:\/\S*)?)/i;

const HOST_PORT_PATTERN =
	/(?:localhost|127\.0\.0\.1|0\.0\.0\.0|\[[0-9a-f:]+\]|(?:\d{1,3}\.){3}\d{1,3}):(\d{2,5})/i;

function stripAnsi(s: string): string {
	return s.replace(ANSI_PATTERN, "");
}

/**
 * Extract a locally-reachable URL from a log chunk. Returns null if no URL
 * is present. Normalises wildcard binds (0.0.0.0 / ::) to `localhost` so
 * AutoKanban always has a concrete host to connect to.
 */
export function detectDevServerUrl(chunk: string): string | null {
	const text = stripAnsi(chunk);

	const full = FULL_URL_PATTERN.exec(text);
	if (full) {
		try {
			const parsed = new URL(full[1]);
			if (!parsed.port) {
				// Fall through; urls without port can't be proxied (no dest port).
			} else {
				const host =
					parsed.hostname === "0.0.0.0" ||
					parsed.hostname === "::" ||
					parsed.hostname === "[::]"
						? "localhost"
						: parsed.hostname;
				return `${parsed.protocol}//${host}:${parsed.port}${parsed.pathname || "/"}`;
			}
		} catch {
			/* fall through */
		}
	}

	const hostPort = HOST_PORT_PATTERN.exec(text);
	if (hostPort) {
		const scheme = /https/i.test(text) ? "https" : "http";
		return `${scheme}://localhost:${hostPort[1]}/`;
	}

	return null;
}
