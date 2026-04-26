// @specre 01KQ46NAA0F829KC90BEK8VW3H

/**
 * Per-key serialization. Operations sharing a key run one at a time;
 * different keys run in parallel.
 *
 * Backed by a promise chain per key. Each `runExclusive` call waits for the
 * previous holder of the same key, then runs `fn`. The chain entry is
 * removed once it is the tail, so long-lived locks do not leak entries for
 * keys that go idle.
 *
 * Single-process only — this does not synchronize across processes or
 * machines. AutoKanban runs as a single Node/Bun process, which is the
 * only place we currently need to serialize concurrent git operations on
 * the same parent repo (`.git/index.lock` would otherwise reject the
 * second writer with "Another git process seems to be running").
 */
export class KeyedLock {
	private chains = new Map<string, Promise<unknown>>();

	async runExclusive<T>(key: string, fn: () => Promise<T>): Promise<T> {
		const prev = this.chains.get(key);
		const next = (async () => {
			if (prev) {
				try {
					await prev;
				} catch {
					// Swallow — a prior failure should not poison the queue.
				}
			}
			return fn();
		})();
		this.chains.set(key, next);
		try {
			return (await next) as T;
		} finally {
			// Only clear the slot if no later caller has chained onto it; that
			// caller will handle its own cleanup when its turn finishes.
			if (this.chains.get(key) === next) {
				this.chains.delete(key);
			}
		}
	}
}
