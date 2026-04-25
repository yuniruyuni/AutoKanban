import { describe, expect, test } from "bun:test";
import { unlinkSync } from "node:fs";
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

	test("kills descendant processes on timeout", async () => {
		const pidFile = `/tmp/script-runner-test-${Date.now()}-${Math.random().toString(36).slice(2)}.pid`;

		const result = await repo.run(ctx, {
			command: `sleep 30 & echo $! > ${pidFile}; wait`,
			workingDir: "/tmp",
			timeoutMs: 500,
		});

		expect(result.exitCode).toBe(124);

		const childPid = Number.parseInt(
			(await Bun.file(pidFile).text()).trim(),
			10,
		);
		expect(Number.isFinite(childPid)).toBe(true);

		let alive = true;
		for (let i = 0; i < 20 && alive; i++) {
			try {
				process.kill(childPid, 0);
				await new Promise((r) => setTimeout(r, 50));
			} catch {
				alive = false;
			}
		}
		expect(alive).toBe(false);

		try {
			unlinkSync(pidFile);
		} catch {
			// ignore — pid file is best-effort cleanup
		}
	});
});
