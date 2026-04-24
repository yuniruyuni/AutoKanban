import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { detectPreviewUrl } from "./detect-preview-url";

/**
 * URL detection must rewrite any localhost-ish hostname to whatever host
 * the user is actually viewing AutoKanban from. The previous behaviour only
 * rewrote `0.0.0.0` / `::`, which broke the iframe for anyone accessing
 * AutoKanban over LAN: "localhost:53419" in the iframe src resolved to the
 * viewer's own machine instead of the server running Vite.
 */

const ORIGINAL_LOCATION = window.location;

function mockBrowserHostname(hostname: string) {
	Object.defineProperty(window, "location", {
		value: { ...ORIGINAL_LOCATION, hostname },
		writable: true,
	});
}

beforeEach(() => {
	mockBrowserHostname("192.168.10.22");
});

afterEach(() => {
	Object.defineProperty(window, "location", {
		value: ORIGINAL_LOCATION,
		writable: true,
	});
});

describe("detectPreviewUrl", () => {
	test("rewrites http://localhost:<port> to the browser host", () => {
		const info = detectPreviewUrl("Local:   http://localhost:53419/");
		expect(info).not.toBeNull();
		expect(info?.url).toBe("http://192.168.10.22:53419/");
		expect(info?.port).toBe(53419);
	});

	test("rewrites http://127.0.0.1:<port> to the browser host", () => {
		const info = detectPreviewUrl("  ➜  Local:   http://127.0.0.1:5173/");
		expect(info?.url).toBe("http://192.168.10.22:5173/");
	});

	test("rewrites http://0.0.0.0:<port> to the browser host", () => {
		const info = detectPreviewUrl("Server running on http://0.0.0.0:3000");
		expect(info?.url).toBe("http://192.168.10.22:3000/");
	});

	test("keeps non-localhost hostnames verbatim", () => {
		const info = detectPreviewUrl("Local:   http://10.1.2.3:4567/");
		expect(info?.url).toBe("http://10.1.2.3:4567/");
	});

	test("when viewed from the same machine the rewrite is a no-op", () => {
		mockBrowserHostname("localhost");
		const info = detectPreviewUrl("Local:   http://localhost:8080/");
		expect(info?.url).toBe("http://localhost:8080/");
	});

	test("strips ANSI color escapes before matching", () => {
		const info = detectPreviewUrl(
			"\x1b[36m➜\x1b[0m  \x1b[1mLocal\x1b[22m:   \x1b[36mhttp://localhost:\x1b[1m53419\x1b[22m/\x1b[0m",
		);
		expect(info?.url).toBe("http://192.168.10.22:53419/");
	});

	test("falls back to host:port pattern when only that is printed", () => {
		const info = detectPreviewUrl("listening on localhost:8080");
		expect(info?.url).toBe("http://192.168.10.22:8080");
		expect(info?.port).toBe(8080);
	});

	test("returns null on lines with no recognisable URL", () => {
		expect(detectPreviewUrl("building for production...")).toBeNull();
	});
});
