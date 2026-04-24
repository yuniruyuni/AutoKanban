import { describe, expect, test } from "bun:test";
import { detectDevServerUrl } from "./index";

/**
 * `detectDevServerUrl` reads a dev server's stdout chunk and returns a URL
 * AutoKanban can reach locally (the proxy forwards to this). It's
 * intentionally different from the client-side detector, which rewrites
 * hostnames for the viewer's browser.
 */

describe("detectDevServerUrl", () => {
	test("returns localhost URL for http://localhost:<port>", () => {
		expect(detectDevServerUrl("Local:   http://localhost:5173/")).toBe(
			"http://localhost:5173/",
		);
	});

	test("returns localhost URL for http://127.0.0.1:<port>", () => {
		expect(detectDevServerUrl("  ➜  Local:   http://127.0.0.1:3000/")).toBe(
			"http://127.0.0.1:3000/",
		);
	});

	test("normalises http://0.0.0.0:<port> to localhost", () => {
		expect(detectDevServerUrl("Server running on http://0.0.0.0:4000")).toBe(
			"http://0.0.0.0:4000/".replace("0.0.0.0", "localhost"),
		);
	});

	test("preserves LAN IPs verbatim (caller's responsibility to reach)", () => {
		expect(detectDevServerUrl("listening at http://10.1.2.3:8080/")).toBe(
			"http://10.1.2.3:8080/",
		);
	});

	test("strips ANSI colour escapes before matching", () => {
		const chunk =
			"\x1b[32m➜\x1b[0m  Local: \x1b[36mhttp://localhost:\x1b[1m7777\x1b[22m/\x1b[0m";
		expect(detectDevServerUrl(chunk)).toBe("http://localhost:7777/");
	});

	test("falls through to host:port when no scheme is printed", () => {
		expect(detectDevServerUrl("ready on localhost:9000")).toBe(
			"http://localhost:9000/",
		);
	});

	test("returns null when chunk has no URL", () => {
		expect(detectDevServerUrl("building for production...")).toBeNull();
	});

	test("ignores full URLs with no port (nothing to proxy to)", () => {
		// host without port: no way to know where to connect
		expect(detectDevServerUrl("check http://localhost/")).toBeNull();
	});
});
