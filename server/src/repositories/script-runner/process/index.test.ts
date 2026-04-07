import { describe, expect, test } from "bun:test";
import { createServiceCtx } from "../../common";
import { ScriptRunnerRepository } from "./index";

describe("ScriptRunnerRepository", () => {
	const repo = new ScriptRunnerRepository();
	const ctx = createServiceCtx();

	test("runs a successful command and captures stdout", async () => {
		const result = await repo.run(ctx, {
			command: 'echo "hello world"',
			workingDir: "/tmp",
		});

		expect(result.exitCode).toBe(0);
		expect(result.stdout.trim()).toBe("hello world");
	});

	test("captures stderr and non-zero exit code on failure", async () => {
		const result = await repo.run(ctx, {
			command: 'echo "error" >&2 && exit 1',
			workingDir: "/tmp",
		});

		expect(result.exitCode).toBe(1);
		expect(result.stderr.trim()).toBe("error");
	});

	test("returns exit code 124 on timeout", async () => {
		const result = await repo.run(ctx, {
			command: "sleep 10",
			workingDir: "/tmp",
			timeoutMs: 500,
		});

		expect(result.exitCode).toBe(124);
	});
});
