import { describe, expect, test } from "bun:test";
import { KeyedLock } from "./keyed-lock";

describe("KeyedLock", () => {
	test("serializes operations on the same key", async () => {
		const lock = new KeyedLock();
		const order: string[] = [];

		const slow = lock.runExclusive("repo", async () => {
			order.push("slow:start");
			await new Promise((r) => setTimeout(r, 30));
			order.push("slow:end");
		});
		const fast = lock.runExclusive("repo", async () => {
			order.push("fast:start");
			order.push("fast:end");
		});

		await Promise.all([slow, fast]);

		expect(order).toEqual(["slow:start", "slow:end", "fast:start", "fast:end"]);
	});

	test("runs different keys concurrently", async () => {
		const lock = new KeyedLock();
		const order: string[] = [];

		const a = lock.runExclusive("repo-a", async () => {
			order.push("a:start");
			await new Promise((r) => setTimeout(r, 30));
			order.push("a:end");
		});
		const b = lock.runExclusive("repo-b", async () => {
			order.push("b:start");
			order.push("b:end");
		});

		await Promise.all([a, b]);

		// b finishes before a:end because they run on different keys.
		expect(order).toEqual(["a:start", "b:start", "b:end", "a:end"]);
	});

	test("a failed holder does not block the next caller on the same key", async () => {
		const lock = new KeyedLock();

		const failed = await lock
			.runExclusive("repo", async () => {
				throw new Error("boom");
			})
			.catch((e: unknown) => e);
		expect((failed as Error).message).toBe("boom");

		const result = await lock.runExclusive("repo", async () => "ok");
		expect(result).toBe("ok");
	});

	test("returns the function's resolved value", async () => {
		const lock = new KeyedLock();
		const value = await lock.runExclusive("repo", async () => 42);
		expect(value).toBe(42);
	});
});
