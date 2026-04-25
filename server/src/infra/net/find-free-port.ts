import { createServer } from "node:net";
import type { ILogger } from "../logger/types";

/**
 * Ask the OS for a free TCP port by binding to port 0 on loopback and then
 * releasing it. The window between close and the caller binding is small but
 * non-zero, so callers prone to racing the next bind should reach for
 * {@link listenOnFreePort}, which retries acquire+bind atomically.
 */
export function findFreePort(): Promise<number> {
	return new Promise((resolve, reject) => {
		const server = createServer();
		server.listen(0, () => {
			const addr = server.address();
			if (typeof addr === "object" && addr) {
				const port = addr.port;
				server.close(() => resolve(port));
			} else {
				server.close(() => reject(new Error("Failed to get port")));
			}
		});
		server.on("error", reject);
	});
}

export interface ListenOnFreePortOptions {
	/** Retry budget when bind races EADDRINUSE. Defaults to 5. */
	attempts?: number;
	/** Logger used to surface retry attempts. */
	logger?: Pick<ILogger, "warn">;
	/** Label included in retry warnings and the final error message. */
	label?: string;
}

export interface ListenOnFreePortResult<T> {
	port: number;
	result: T;
}

/**
 * Acquire a free TCP port AND bind to it atomically, retrying on EADDRINUSE.
 *
 * `findFreePort` alone leaves a race window between close and the caller's
 * bind — another process can steal the port. This wrapper retries the entire
 * (acquire + bind) cycle so transient races during burst port allocation
 * (test parallelism, dev-server startup, embedded-postgres) surface as a
 * single transparent retry instead of a hard failure.
 *
 * The `listen` callback receives the candidate port and must perform the
 * actual bind (e.g. `Bun.serve({ port })`, `pg.start()` after `port` was
 * stamped on its config). Its return value flows back to the caller.
 */
export async function listenOnFreePort<T>(
	listen: (port: number) => Promise<T> | T,
	options: ListenOnFreePortOptions = {},
): Promise<ListenOnFreePortResult<T>> {
	const attempts = options.attempts ?? 5;
	if (attempts < 1) {
		throw new RangeError("listenOnFreePort: attempts must be >= 1");
	}
	const errors: unknown[] = [];
	for (let i = 0; i < attempts; i++) {
		const port = await findFreePort();
		try {
			const result = await listen(port);
			return { port, result };
		} catch (err) {
			if (!isPortConflictError(err)) throw err;
			errors.push(err);
			options.logger?.warn(
				`${options.label ?? "listenOnFreePort"}: port ${port} taken before bind, retrying (attempt ${i + 1}/${attempts})`,
			);
		}
	}
	const detail = errors
		.map((e) => (e instanceof Error ? e.message : String(e)))
		.join("; ");
	throw new Error(
		`Failed to bind to a free port after ${attempts} attempts${
			options.label ? ` (${options.label})` : ""
		}: ${detail}`,
	);
}

/**
 * Detects an EADDRINUSE error across every surface this codebase actually
 * binds: Node's `net` module sets `code === "EADDRINUSE"`, `Bun.serve`
 * throws an `Error` whose message contains "EADDRINUSE", and PostgreSQL
 * reports "Address already in use" through embedded-postgres. All three
 * mean the port slipped to another listener between acquire and bind.
 */
export function isPortConflictError(err: unknown): boolean {
	if (!err || typeof err !== "object") return false;
	const code = (err as { code?: unknown }).code;
	if (code === "EADDRINUSE") return true;
	const msg = (err as { message?: unknown }).message;
	if (typeof msg !== "string") return false;
	return /EADDRINUSE|address already in use/i.test(msg);
}
