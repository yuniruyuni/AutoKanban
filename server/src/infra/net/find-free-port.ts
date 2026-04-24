import { createServer } from "node:net";

/**
 * Ask the OS for a free TCP port by binding to port 0 on loopback and then
 * releasing it. The window between close and the caller binding is small but
 * non-zero, so callers should tolerate an occasional race (retry on
 * EADDRINUSE) when allocating many ports in rapid succession.
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
