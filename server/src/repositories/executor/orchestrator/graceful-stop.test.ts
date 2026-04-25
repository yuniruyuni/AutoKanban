import { describe, expect, test } from "bun:test";
import { performGracefulStop } from "./graceful-stop";

function deferred<T>() {
	let resolve!: (value: T) => void;
	const promise = new Promise<T>((r) => {
		resolve = r;
	});
	return { promise, resolve };
}

describe("performGracefulStop", () => {
	test("returns without forcing when process exits before timeout", async () => {
		const exit = deferred<{ exitCode: number; killed: boolean }>();
		let interrupts = 0;
		let kills = 0;

		const promise = performGracefulStop(
			{
				interrupt: () => {
					interrupts++;
					exit.resolve({ exitCode: 0, killed: false });
				},
				kill: () => {
					kills++;
				},
				exited: exit.promise,
			},
			{ timeoutMs: 1000 },
		);

		const result = await promise;
		expect(result).toEqual({ exitCode: 0, killed: false, forced: false });
		expect(interrupts).toBe(1);
		expect(kills).toBe(0);
	});

	test("sends SIGKILL when process does not exit before timeout", async () => {
		const exit = deferred<{ exitCode: number; killed: boolean }>();
		let interrupts = 0;
		let kills = 0;

		const promise = performGracefulStop(
			{
				interrupt: () => {
					interrupts++;
				},
				kill: () => {
					kills++;
					exit.resolve({ exitCode: 137, killed: true });
				},
				exited: exit.promise,
			},
			{ timeoutMs: 50 },
		);

		const result = await promise;
		expect(result).toEqual({ exitCode: 137, killed: true, forced: true });
		expect(interrupts).toBe(1);
		expect(kills).toBe(1);
	});

	test("survives interrupt() throwing (process already dead)", async () => {
		const exit = deferred<{ exitCode: number; killed: boolean }>();

		const promise = performGracefulStop(
			{
				interrupt: () => {
					throw new Error("ESRCH: no such process");
				},
				kill: () => {},
				exited: exit.promise,
			},
			{ timeoutMs: 50 },
		);

		exit.resolve({ exitCode: 0, killed: false });
		const result = await promise;
		expect(result.forced).toBe(false);
	});

	test("survives kill() throwing after timeout (process already dead)", async () => {
		const exit = deferred<{ exitCode: number; killed: boolean }>();

		const promise = performGracefulStop(
			{
				interrupt: () => {},
				kill: () => {
					throw new Error("ESRCH: no such process");
				},
				exited: exit.promise,
			},
			{ timeoutMs: 20 },
		);

		setTimeout(() => exit.resolve({ exitCode: 0, killed: true }), 40);
		const result = await promise;
		expect(result.forced).toBe(true);
		expect(result.killed).toBe(true);
	});
});
