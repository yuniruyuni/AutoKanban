import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { WorkspaceConfigRepository } from ".";

describe("WorkspaceConfigRepository", () => {
	let tempDir: string;

	afterEach(async () => {
		if (tempDir) await rm(tempDir, { recursive: true, force: true });
	});

	async function setup(content?: string): Promise<string> {
		tempDir = await mkdtemp(join(tmpdir(), "ws-config-test-"));
		if (content !== undefined) {
			await writeFile(join(tempDir, "auto-kanban.json"), content);
		}
		return tempDir;
	}

	test("loads valid auto-kanban.json", async () => {
		const dir = await setup(
			JSON.stringify({
				prepare: "bun install",
				server: "bun run dev",
				cleanup: "rm -rf node_modules",
			}),
		);
		const repo = new WorkspaceConfigRepository();
		const config = await repo.load(dir);
		expect(config.prepare).toBe("bun install");
		expect(config.server).toBe("bun run dev");
		expect(config.cleanup).toBe("rm -rf node_modules");
	});

	test("returns empty config when file does not exist", async () => {
		const dir = await setup();
		const repo = new WorkspaceConfigRepository();
		const config = await repo.load(dir);
		expect(config.prepare).toBeNull();
		expect(config.server).toBeNull();
		expect(config.cleanup).toBeNull();
	});

	test("returns empty config on parse error", async () => {
		const dir = await setup("{ invalid json }}}");
		const repo = new WorkspaceConfigRepository();
		const config = await repo.load(dir);
		expect(config.prepare).toBeNull();
		expect(config.server).toBeNull();
		expect(config.cleanup).toBeNull();
	});

	test("parses JSONC with comments", async () => {
		const dir = await setup(`{
      // setup command
      "prepare": "npm install",
      /* dev server */
      "server": "npm start"
    }`);
		const repo = new WorkspaceConfigRepository();
		const config = await repo.load(dir);
		expect(config.prepare).toBe("npm install");
		expect(config.server).toBe("npm start");
		expect(config.cleanup).toBeNull();
	});

	test("handles partial config (only some fields)", async () => {
		const dir = await setup(JSON.stringify({ server: "bun run dev" }));
		const repo = new WorkspaceConfigRepository();
		const config = await repo.load(dir);
		expect(config.prepare).toBeNull();
		expect(config.server).toBe("bun run dev");
		expect(config.cleanup).toBeNull();
	});
});
