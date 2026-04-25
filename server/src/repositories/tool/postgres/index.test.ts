import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { createTestTool } from "../../../../test/factories";
import { closeTestDB, createTestDB } from "../../../../test/helpers/db";
import { expectEntityEqual } from "../../../../test/helpers/entity-equality";
import type { Database } from "../../../infra/db/database";
import { Tool } from "../../../models/tool";
import type { DbReadCtx, DbWriteCtx, ServiceCtx } from "../../common";
import {
	createDbReadCtx,
	createDbWriteCtx,
	createServiceCtx,
} from "../../common";
import { ToolRepository } from ".";

let db: Database;
let toolRepo: ToolRepository;
let rCtx: DbReadCtx;
let wCtx: DbWriteCtx;
let sCtx: ServiceCtx;

beforeEach(async () => {
	db = await createTestDB();
	toolRepo = new ToolRepository();
	rCtx = createDbReadCtx(db);
	wCtx = createDbWriteCtx(db);
	sCtx = createServiceCtx();
});

afterEach(async () => {
	await closeTestDB(db);
});

// ============================================
// P1: Round-trip
// ============================================

describe("ToolRepository round-trip", () => {
	test("preserves all fields", async () => {
		const tool = createTestTool({
			name: "Deploy",
			icon: "rocket",
			iconColor: "#FF5733",
			command: "npm run deploy",
			sortOrder: 5,
		});
		await toolRepo.upsert(wCtx, tool);

		const retrieved = await toolRepo.get(rCtx, Tool.ById(tool.id));
		expect(retrieved).not.toBeNull();
		expectEntityEqual(retrieved as Tool, tool, ["createdAt", "updatedAt"]);
	});

	test("preserves argv array including shell-metacharacter args", async () => {
		const tool = createTestTool({
			name: "Cursor",
			argv: ["cursor", "/my repo; touch x", "$HOME"],
		});
		await toolRepo.upsert(wCtx, tool);

		const retrieved = await toolRepo.get(rCtx, Tool.ById(tool.id));
		expect(retrieved).not.toBeNull();
		expect(retrieved?.argv).toEqual(["cursor", "/my repo; touch x", "$HOME"]);
	});

	test("preserves default iconColor", async () => {
		const tool = createTestTool(); // default iconColor = '#6B7280'
		await toolRepo.upsert(wCtx, tool);

		const retrieved = await toolRepo.get(rCtx, Tool.ById(tool.id));
		expect(retrieved).not.toBeNull();
		expect(retrieved?.iconColor).toBe("#6B7280");
	});

	test("preserves sortOrder=0", async () => {
		const tool = createTestTool({ sortOrder: 0 });
		await toolRepo.upsert(wCtx, tool);

		const retrieved = await toolRepo.get(rCtx, Tool.ById(tool.id));
		expect(retrieved).not.toBeNull();
		expect(retrieved?.sortOrder).toBe(0);
	});
});

// ============================================
// P2: Update round-trip
// ============================================

describe("ToolRepository update round-trip", () => {
	test("reflects all changed fields", async () => {
		const tool = createTestTool();
		await toolRepo.upsert(wCtx, tool);

		const updated: Tool = {
			...tool,
			name: "Updated Tool",
			icon: "hammer",
			iconColor: "#00FF00",
			command: "bun run updated",
			sortOrder: 10,
			updatedAt: new Date(),
		};
		await toolRepo.upsert(wCtx, updated);

		const retrieved = await toolRepo.get(rCtx, Tool.ById(tool.id));
		expect(retrieved).not.toBeNull();
		expectEntityEqual(retrieved as Tool, updated, ["createdAt", "updatedAt"]);
	});
});

// ============================================
// P3: Empty collection
// ============================================

describe("ToolRepository empty collection", () => {
	test("get returns null for non-existent id", async () => {
		expect(await toolRepo.get(rCtx, Tool.ById("non-existent"))).toBeNull();
	});

	test("list returns empty page", async () => {
		const page = await toolRepo.list(rCtx, Tool.All(), { limit: 10 });
		expect(page.items).toHaveLength(0);
		expect(page.hasMore).toBe(false);
	});

	test("listAll returns empty array", async () => {
		expect(await toolRepo.listAll(rCtx)).toHaveLength(0);
	});
});

// ============================================
// P4: Multiple elements
// ============================================

describe("ToolRepository multiple elements", () => {
	test("stores and retrieves multiple tools", async () => {
		for (let i = 0; i < 3; i++) {
			await toolRepo.upsert(
				wCtx,
				createTestTool({ name: `Tool ${i}`, sortOrder: i }),
			);
		}

		const page = await toolRepo.list(rCtx, Tool.All(), { limit: 50 });
		expect(page.items).toHaveLength(3);
	});
});

// ============================================
// P5: Delete
// ============================================

describe("ToolRepository delete", () => {
	test("deletes and confirms absence", async () => {
		const tool = createTestTool();
		await toolRepo.upsert(wCtx, tool);

		const deleted = await toolRepo.delete(wCtx, Tool.ById(tool.id));
		expect(deleted).toBe(1);
		expect(await toolRepo.get(rCtx, Tool.ById(tool.id))).toBeNull();
	});

	test("returns 0 when nothing to delete", async () => {
		expect(await toolRepo.delete(wCtx, Tool.ById("non-existent"))).toBe(0);
	});
});

// ============================================
// P6: Spec filtering
// ============================================

describe("ToolRepository spec filtering", () => {
	test("ById finds correct tool", async () => {
		const tool = createTestTool();
		await toolRepo.upsert(wCtx, tool);

		const retrieved = await toolRepo.get(rCtx, Tool.ById(tool.id));
		expect(retrieved).not.toBeNull();
		expect(retrieved?.id).toBe(tool.id);
	});

	test("All matches all tools", async () => {
		await toolRepo.upsert(wCtx, createTestTool({ name: "Tool A" }));
		await toolRepo.upsert(wCtx, createTestTool({ name: "Tool B" }));

		const page = await toolRepo.list(rCtx, Tool.All(), { limit: 50 });
		expect(page.items).toHaveLength(2);
	});
});

// ============================================
// P7: listAll (sorted by sortOrder)
// ============================================

describe("ToolRepository listAll", () => {
	test("returns tools sorted by sortOrder ascending", async () => {
		await toolRepo.upsert(
			wCtx,
			createTestTool({ name: "Third", sortOrder: 3 }),
		);
		await toolRepo.upsert(
			wCtx,
			createTestTool({ name: "First", sortOrder: 1 }),
		);
		await toolRepo.upsert(
			wCtx,
			createTestTool({ name: "Second", sortOrder: 2 }),
		);

		const all = await toolRepo.listAll(rCtx);
		expect(all).toHaveLength(3);
		expect(all[0].name).toBe("First");
		expect(all[1].name).toBe("Second");
		expect(all[2].name).toBe("Third");
	});
});

// ============================================
// P8: executeCommand (shell execution)
// ============================================

describe("ToolRepository executeCommand", () => {
	test("spawns argv directly without a shell", () => {
		let capturedCmd: string[] = [];
		let capturedCwd: string | undefined;

		const spawnSpy = ((opts: { cmd: string[]; cwd?: string }) => {
			capturedCmd = opts.cmd;
			capturedCwd = opts.cwd;
		}) as never;

		const repo = new ToolRepository(spawnSpy);
		repo.executeCommand(sCtx, ["code", "/my/project"], "/my/project");

		// argv vector is passed verbatim — no `sh -c` wrapping. Bun.spawn does
		// PATH lookup on argv[0], so PATH-based binaries still resolve.
		expect(capturedCmd).toEqual(["code", "/my/project"]);
		expect(capturedCwd).toBe("/my/project");
	});

	test("preserves args containing shell metacharacters as-is", () => {
		let capturedCmd: string[] = [];
		const spawnSpy = ((opts: { cmd: string[] }) => {
			capturedCmd = opts.cmd;
		}) as never;

		const repo = new ToolRepository(spawnSpy);
		repo.executeCommand(sCtx, ["echo", "/my repo; rm -rf $HOME"]);

		// Without a shell, `;` and `$HOME` are literal characters in the arg.
		expect(capturedCmd).toEqual(["echo", "/my repo; rm -rf $HOME"]);
	});

	test("passes cwd as undefined when not provided", () => {
		let capturedCwd: string | undefined = "should-be-overwritten";

		const spawnSpy = ((opts: { cmd: string[]; cwd?: string }) => {
			capturedCwd = opts.cwd;
		}) as never;

		const repo = new ToolRepository(spawnSpy);
		repo.executeCommand(sCtx, ["echo", "test"]);

		expect(capturedCwd).toBeUndefined();
	});
});
