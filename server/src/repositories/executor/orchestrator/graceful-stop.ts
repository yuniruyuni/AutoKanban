/**
 * Default time to wait between SIGINT and SIGKILL during graceful shutdown.
 * Drivers should override this if their agent needs longer to drain.
 */
export const DEFAULT_GRACEFUL_STOP_TIMEOUT_MS = 5000;

export interface GracefulStopHandlers {
	/** Send SIGINT to ask the agent to wind down gracefully. */
	interrupt: () => void;
	/** Force-kill (SIGKILL) the process. Called only if SIGINT did not exit in time. */
	kill: () => void;
	/** Resolves when the underlying process has exited. */
	exited: Promise<{ exitCode: number; killed: boolean }>;
}

export interface GracefulStopResult {
	exitCode: number;
	killed: boolean;
	/** True if SIGKILL had to be sent because SIGINT did not exit within timeoutMs. */
	forced: boolean;
}

/**
 * Driver-agnostic graceful shutdown:
 *   1. send SIGINT
 *   2. wait up to `timeoutMs` for the process to exit
 *   3. if it does not exit in time, send SIGKILL and wait
 *
 * Errors thrown by `interrupt` / `kill` are swallowed because they almost always
 * mean the process has already died — the source of truth is `exited`.
 */
export async function performGracefulStop(
	handlers: GracefulStopHandlers,
	options: { timeoutMs: number },
): Promise<GracefulStopResult> {
	try {
		handlers.interrupt();
	} catch {
		// Process may already be dead — proceed to wait for exit.
	}

	let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
	const timedOut = await Promise.race<boolean>([
		handlers.exited.then(() => false),
		new Promise<true>((resolve) => {
			timeoutHandle = setTimeout(() => resolve(true), options.timeoutMs);
		}),
	]);
	if (timeoutHandle) clearTimeout(timeoutHandle);

	if (!timedOut) {
		const result = await handlers.exited;
		return { ...result, forced: false };
	}

	try {
		handlers.kill();
	} catch {
		// Already dead.
	}
	const result = await handlers.exited;
	return { ...result, forced: true };
}
