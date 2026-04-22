import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createMockLogger } from "../../../test/helpers/logger";
import type { PgDatabase } from "../../infra/db/pg-client";
import type { Context } from "../runner";
import { browseDirectory } from "./browse-directory";

// Minimal mock context - browseDirectory doesn't use repos or logStreamer
const mockContext: Context = {
	now: new Date(),
	logger: createMockLogger(),
	db: {
		transaction: async <T>(fn: (tx: PgDatabase) => Promise<T>) =>
			fn({} as PgDatabase),
		readTransaction: async <T>(fn: (tx: PgDatabase) => Promise<T>) =>
			fn({} as PgDatabase),
	} as PgDatabase,
	rawRepos: Object.fromEntries(
		[
			"task",
			"taskTemplate",
			"project",
			"workspace",
			"workspaceRepo",
			"session",
			"executionProcess",
			"executionProcessLogs",
			"codingAgentTurn",
			"tool",
			"variant",
			"approval",
			"git",
			"worktree",
			"executor",
			"messageQueue",
			"agentConfig",
			"workspaceConfig",
			"draft",
			"permissionStore",
			"approvalStore",
			"logStoreManager",
			"devServer",
		].map((k) => [k, {}]),
	) as unknown as Context["rawRepos"],
	repos: {} as Context["repos"],
};

describe("browseDirectory", () => {
	let testDir: string;

	beforeEach(() => {
		// Create unique test directory
		testDir = join(tmpdir(), `browse-test-${Date.now()}`);
		mkdirSync(testDir, { recursive: true });
	});

	afterEach(() => {
		// Cleanup
		rmSync(testDir, { recursive: true, force: true });
	});

	test("returns only directories when includeFiles is false", async () => {
		// Setup
		mkdirSync(join(testDir, "subdir"));
		writeFileSync(join(testDir, "file.txt"), "test");

		// Execute
		const result = await browseDirectory(testDir, false).run(mockContext);

		// Verify
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.value.entries).toHaveLength(1);
		expect(result.value.entries[0].name).toBe("subdir");
		expect(result.value.entries[0].isDirectory).toBe(true);
	});

	test("returns files and directories when includeFiles is true", async () => {
		// Setup
		mkdirSync(join(testDir, "subdir"));
		writeFileSync(join(testDir, "file.txt"), "test content");

		// Execute
		const result = await browseDirectory(testDir, true).run(mockContext);

		// Verify
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.value.entries).toHaveLength(2);

		const dir = result.value.entries.find((e) => e.name === "subdir");
		const file = result.value.entries.find((e) => e.name === "file.txt");

		expect(dir?.isDirectory).toBe(true);
		expect(file?.isDirectory).toBe(false);
		expect(file?.size).toBe(12); // 'test content' = 12 bytes
	});

	test("excludes hidden files", async () => {
		// Setup
		writeFileSync(join(testDir, ".hidden"), "secret");
		writeFileSync(join(testDir, "visible.txt"), "public");

		// Execute
		const result = await browseDirectory(testDir, true).run(mockContext);

		// Verify
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.value.entries).toHaveLength(1);
		expect(result.value.entries[0].name).toBe("visible.txt");
	});

	test("sorts directories first, then files, both alphabetically", async () => {
		// Setup
		mkdirSync(join(testDir, "zebra"));
		mkdirSync(join(testDir, "alpha"));
		writeFileSync(join(testDir, "middle.txt"), "");
		writeFileSync(join(testDir, "apple.txt"), "");

		// Execute
		const result = await browseDirectory(testDir, true).run(mockContext);

		// Verify
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		const names = result.value.entries.map((e) => e.name);
		expect(names).toEqual(["alpha", "zebra", "apple.txt", "middle.txt"]);
	});

	test("returns empty array for empty directory", async () => {
		// Execute
		const result = await browseDirectory(testDir, true).run(mockContext);

		// Verify
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.value.entries).toHaveLength(0);
	});

	test("defaults to directories only when includeFiles is not specified", async () => {
		// Setup
		mkdirSync(join(testDir, "subdir"));
		writeFileSync(join(testDir, "file.txt"), "test");

		// Execute
		const result = await browseDirectory(testDir).run(mockContext);

		// Verify
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.value.entries).toHaveLength(1);
		expect(result.value.entries[0].name).toBe("subdir");
	});

	test("detects git repositories", async () => {
		// Setup
		const gitRepoDir = join(testDir, "my-repo");
		mkdirSync(gitRepoDir);
		mkdirSync(join(gitRepoDir, ".git"));

		const normalDir = join(testDir, "normal-dir");
		mkdirSync(normalDir);

		// Execute
		const result = await browseDirectory(testDir).run(mockContext);

		// Verify
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.value.entries).toHaveLength(2);

		const gitRepo = result.value.entries.find((e) => e.name === "my-repo");
		const normalDirEntry = result.value.entries.find(
			(e) => e.name === "normal-dir",
		);

		expect(gitRepo?.isGitRepo).toBe(true);
		expect(normalDirEntry?.isGitRepo).toBe(false);
	});

	test("returns error for non-existent path", async () => {
		// Execute
		const result = await browseDirectory("/nonexistent/path").run(mockContext);

		// Verify
		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.error.code).toBe("NOT_FOUND");
	});

	test("returns error for file path instead of directory", async () => {
		// Setup
		const filePath = join(testDir, "not-a-dir.txt");
		writeFileSync(filePath, "content");

		// Execute
		const result = await browseDirectory(filePath).run(mockContext);

		// Verify
		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.error.code).toBe("INVALID_PATH");
	});

	test("returns correct parent path", async () => {
		// Setup
		const subDir = join(testDir, "subdir");
		mkdirSync(subDir);

		// Execute
		const result = await browseDirectory(subDir).run(mockContext);

		// Verify
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.value.currentPath).toBe(subDir);
		expect(result.value.parentPath).toBe(testDir);
	});
});
