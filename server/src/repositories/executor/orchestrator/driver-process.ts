/**
 * Handle to a running coding agent process.
 * Each driver implementation wraps its native process type.
 */
export interface DriverProcess {
	stdout: ReadableStream<Uint8Array>;
	stderr: ReadableStream<Uint8Array>;
}
