import { afterEach, describe, expect, test } from "bun:test";
import { createServer, type Server } from "node:net";
import {
	findFreePort,
	isPortConflictError,
	listenOnFreePort,
} from "./find-free-port";

const cleanup: Array<() => Promise<void> | void> = [];

afterEach(async () => {
	for (const fn of cleanup.splice(0)) await fn();
});

function bindNetServer(port: number): Promise<Server> {
	return new Promise((resolve, reject) => {
		const s = createServer();
		s.once("error", reject);
		s.listen(port, () => resolve(s));
	});
}

function closeServer(s: Server): Promise<void> {
	return new Promise((r) => s.close(() => r()));
}

function eaddrInUseError(): Error & { code: string } {
	const err = new Error(
		"listen EADDRINUSE: address already in use",
	) as Error & {
		code: string;
	};
	err.code = "EADDRINUSE";
	return err;
}

describe("findFreePort", () => {
	test("returns a port the kernel will let us bind", async () => {
		const port = await findFreePort();
		expect(typeof port).toBe("number");
		expect(port).toBeGreaterThan(0);

		const s = await bindNetServer(port);
		cleanup.push(() => closeServer(s));
	});
});

describe("isPortConflictError", () => {
	test("matches Node-style errors via code", () => {
		expect(isPortConflictError(eaddrInUseError())).toBe(true);
	});

	test("matches Bun-style errors via message text", () => {
		expect(isPortConflictError(new Error("EADDRINUSE: 127.0.0.1:1234"))).toBe(
			true,
		);
	});

	test("matches PostgreSQL-style 'Address already in use'", () => {
		expect(
			isPortConflictError(
				new Error(
					"FATAL: could not bind IPv4 address '127.0.0.1': Address already in use",
				),
			),
		).toBe(true);
	});

	test("rejects unrelated errors", () => {
		expect(isPortConflictError(new Error("boom"))).toBe(false);
		expect(isPortConflictError(null)).toBe(false);
		expect(isPortConflictError(undefined)).toBe(false);
		expect(isPortConflictError("string")).toBe(false);
	});
});

describe("listenOnFreePort", () => {
	test("returns the bound port and the listen callback's result", async () => {
		const { port, result } = await listenOnFreePort(async (p) => {
			const s = await bindNetServer(p);
			cleanup.push(() => closeServer(s));
			return { server: s };
		});
		expect(port).toBeGreaterThan(0);
		expect(result.server).toBeDefined();
	});

	test("retries acquire+bind when the listen callback throws EADDRINUSE", async () => {
		let attempts = 0;
		const { port } = await listenOnFreePort(async (p) => {
			attempts++;
			if (attempts === 1) throw eaddrInUseError();
			const s = await bindNetServer(p);
			cleanup.push(() => closeServer(s));
			return s;
		});
		expect(attempts).toBe(2);
		expect(port).toBeGreaterThan(0);
	});

	test("non-EADDRINUSE errors surface immediately without retry", async () => {
		let attempts = 0;
		let caught: unknown;
		try {
			await listenOnFreePort(() => {
				attempts++;
				throw new Error("boom");
			});
		} catch (err) {
			caught = err;
		}
		expect(caught).toBeInstanceOf(Error);
		expect((caught as Error).message).toBe("boom");
		expect(attempts).toBe(1);
	});

	test("throws a descriptive error when all attempts hit EADDRINUSE", async () => {
		let attempts = 0;
		let caught: unknown;
		try {
			await listenOnFreePort(
				() => {
					attempts++;
					throw eaddrInUseError();
				},
				{ attempts: 3, label: "test-resource" },
			);
		} catch (err) {
			caught = err;
		}
		expect(caught).toBeInstanceOf(Error);
		expect((caught as Error).message).toMatch(
			/Failed to bind to a free port after 3 attempts.*test-resource/,
		);
		expect(attempts).toBe(3);
	});

	test("survives genuine concurrent contention by handing back distinct ports", async () => {
		// Burst-allocate: we want concurrent acquire+bind cycles to all succeed
		// even if some find/listen calls race each other on the same OS port.
		const N = 32;
		const results = await Promise.all(
			Array.from({ length: N }, () =>
				listenOnFreePort(async (p) => {
					const s = await bindNetServer(p);
					cleanup.push(() => closeServer(s));
					return s;
				}),
			),
		);
		const ports = new Set(results.map((r) => r.port));
		expect(ports.size).toBe(N);
	});

	test("rejects attempts < 1 with RangeError", async () => {
		let caught: unknown;
		try {
			await listenOnFreePort(() => null, { attempts: 0 });
		} catch (err) {
			caught = err;
		}
		expect(caught).toBeInstanceOf(RangeError);
	});
});
