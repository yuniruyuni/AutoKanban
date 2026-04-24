export interface PreviewUrlInfo {
	url: string;
	port?: number;
	scheme: "http" | "https";
}

const urlPatterns = [
	// Full URL pattern (e.g., http://localhost:3000, https://127.0.0.1:8080)
	/(https?:\/\/(?:\[[0-9a-f:]+\]|localhost|127\.0\.0\.1|0\.0\.0\.0|\d{1,3}(?:\.\d{1,3}){3})(?::\d{2,5})?(?:\/\S*)?)/i,
	// Host:port pattern (e.g., localhost:3000, 0.0.0.0:8080)
	/(?:localhost|127\.0\.0\.1|0\.0\.0\.0|\[[0-9a-f:]+\]|(?:\d{1,3}\.){3}\d{1,3}):(\d{2,5})/i,
];

// Strip ANSI escape codes
function stripAnsi(text: string): string {
	// biome-ignore lint/suspicious/noControlCharactersInRegex: ANSI escape code stripping requires matching control characters
	return text.replace(/\x1b\[[0-9;]*m/g, "");
}

function getBrowserHostname(): string {
	if (typeof window !== "undefined") {
		return window.location.hostname;
	}
	return "localhost";
}

/**
 * Detect a dev server URL from a single log line.
 */
export function detectPreviewUrl(line: string): PreviewUrlInfo | null {
	const cleaned = stripAnsi(line);
	const browserHostname = getBrowserHostname();

	// Try full URL first
	const fullUrlMatch = urlPatterns[0].exec(cleaned);
	if (fullUrlMatch) {
		try {
			const parsed = new URL(fullUrlMatch[1]);

			const isLocalhost = [
				"localhost",
				"127.0.0.1",
				"0.0.0.0",
				"::",
				"[::]",
			].includes(parsed.hostname);

			if (isLocalhost && !parsed.port) {
				// Fall through to host:port pattern
			} else {
				// Always rewrite localhost-like hostnames to whatever host the
				// user is actually opening AutoKanban from. Previously only
				// wildcard binds (0.0.0.0 / ::) were rewritten, which broke the
				// Preview iframe whenever the user accessed AutoKanban from a
				// different machine (e.g. WSL host / LAN): "localhost:PORT"
				// then resolved to the viewer's own machine, not the server's.
				if (isLocalhost) {
					parsed.hostname = browserHostname;
				}
				return {
					url: parsed.toString(),
					port: parsed.port ? Number(parsed.port) : undefined,
					scheme: parsed.protocol === "https:" ? "https" : "http",
				};
			}
		} catch {
			// Fall through to host:port detection
		}
	}

	// Try host:port pattern
	const hostPortMatch = urlPatterns[1].exec(cleaned);
	if (hostPortMatch) {
		const port = Number(hostPortMatch[1]);
		const scheme = /https/i.test(cleaned) ? "https" : "http";
		return {
			url: `${scheme}://${browserHostname}:${port}`,
			port,
			scheme: scheme as "http" | "https",
		};
	}

	return null;
}
