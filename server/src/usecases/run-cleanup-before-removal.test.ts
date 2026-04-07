import { describe, expect, test } from "bun:test";
import { createMockLogger } from "../../test/helpers/logger";
import type { Repos } from "../repositories";
import type { ServiceRepos } from "../repositories/common";
import { runCleanupIfConfigured } from "./run-cleanup-before-removal";

function createMockRepos(
	overrides: {
		workspaceConfig?: {
			load: (path: string) => unknown;
		};
		scriptRunner?: {
			run: (opts: { command: string; workingDir: string }) => unknown;
		};
	} = {},
): ServiceRepos<Repos> {
	return {
		workspaceConfig: overrides.workspaceConfig ?? {
			load: async () => ({ prepare: null, server: null, cleanup: null }),
		},
		scriptRunner: overrides.scriptRunner ?? {
			run: async () => ({ exitCode: 0, stdout: "", stderr: "" }),
		},
	} as unknown as ServiceRepos<Repos>;
}

describe("runCleanupIfConfigured", () => {
	test("runs cleanup command when configured", async () => {
		let capturedCommand: string | undefined;
		let capturedWorkingDir: string | undefined;

		const repos = createMockRepos({
			workspaceConfig: {
				load: async () => ({
					prepare: null,
					server: null,
					cleanup: "bun run cleanup",
				}),
			},
			scriptRunner: {
				run: async (opts: { command: string; workingDir: string }) => {
					capturedCommand = opts.command;
					capturedWorkingDir = opts.workingDir;
					return { exitCode: 0, stdout: "", stderr: "" };
				},
			},
		});

		await runCleanupIfConfigured(repos, createMockLogger(), "/tmp/worktree");

		expect(capturedCommand).toBe("bun run cleanup");
		expect(capturedWorkingDir).toBe("/tmp/worktree");
	});

	test("skips when no cleanup command configured", async () => {
		let scriptRunCalled = false;

		const repos = createMockRepos({
			workspaceConfig: {
				load: async () => ({
					prepare: null,
					server: null,
					cleanup: null,
				}),
			},
			scriptRunner: {
				run: async () => {
					scriptRunCalled = true;
					return { exitCode: 0, stdout: "", stderr: "" };
				},
			},
		});

		await runCleanupIfConfigured(repos, createMockLogger(), "/tmp/worktree");

		expect(scriptRunCalled).toBe(false);
	});

	test("does not throw when cleanup script fails", async () => {
		const repos = createMockRepos({
			workspaceConfig: {
				load: async () => ({
					prepare: null,
					server: null,
					cleanup: "exit 1",
				}),
			},
			scriptRunner: {
				run: async () => ({
					exitCode: 1,
					stdout: "",
					stderr: "cleanup failed",
				}),
			},
		});

		// Should not throw
		await runCleanupIfConfigured(repos, createMockLogger(), "/tmp/worktree");
	});

	test("does not throw when config load fails", async () => {
		const repos = createMockRepos({
			workspaceConfig: {
				load: async () => {
					throw new Error("file not found");
				},
			},
		});

		// Should not throw
		await runCleanupIfConfigured(repos, createMockLogger(), "/tmp/worktree");
	});

	test("does not throw when scriptRunner.run throws", async () => {
		const repos = createMockRepos({
			workspaceConfig: {
				load: async () => ({
					prepare: null,
					server: null,
					cleanup: "some-command",
				}),
			},
			scriptRunner: {
				run: async () => {
					throw new Error("process spawn failed");
				},
			},
		});

		// Should not throw
		await runCleanupIfConfigured(repos, createMockLogger(), "/tmp/worktree");
	});
});
