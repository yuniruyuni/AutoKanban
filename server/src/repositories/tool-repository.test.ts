import type { Database } from "bun:sqlite";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { createTestTool } from "../../test/factories";
import { createTestDB } from "../../test/helpers/db";
import { expectEntityEqual } from "../../test/helpers/entity-equality";
import { Tool } from "../models/tool";
import { ToolRepository } from "./tool-repository";

let db: Database;
let toolRepo: ToolRepository;

beforeEach(() => {
	db = createTestDB();
	toolRepo = new ToolRepository(db);
});

afterEach(() => {
	db.close();
});

// ============================================
// P1: Round-trip
// ============================================

describe("ToolRepository round-trip", () => {
	test("preserves all fields", () => {
		const tool = createTestTool({
			name: "Deploy",
			icon: "rocket",
			iconColor: "#FF5733",
			command: "npm run deploy",
			sortOrder: 5,
		});
		toolRepo.upsert(tool);

		const retrieved = toolRepo.get(Tool.ById(tool.id));
		expect(retrieved).not.toBeNull();
		expectEntityEqual(retrieved as Tool, tool, ["createdAt", "updatedAt"]);
	});

	test("preserves default iconColor", () => {
		const tool = createTestTool(); // default iconColor = '#6B7280'
		toolRepo.upsert(tool);

		const retrieved = toolRepo.get(Tool.ById(tool.id));
		expect(retrieved).not.toBeNull();
		expect(retrieved?.iconColor).toBe("#6B7280");
	});

	test("preserves sortOrder=0", () => {
		const tool = createTestTool({ sortOrder: 0 });
		toolRepo.upsert(tool);

		const retrieved = toolRepo.get(Tool.ById(tool.id));
		expect(retrieved).not.toBeNull();
		expect(retrieved?.sortOrder).toBe(0);
	});
});

// ============================================
// P2: Update round-trip
// ============================================

describe("ToolRepository update round-trip", () => {
	test("reflects all changed fields", () => {
		const tool = createTestTool();
		toolRepo.upsert(tool);

		const updated: Tool = {
			...tool,
			name: "Updated Tool",
			icon: "hammer",
			iconColor: "#00FF00",
			command: "bun run updated",
			sortOrder: 10,
			updatedAt: new Date(),
		};
		toolRepo.upsert(updated);

		const retrieved = toolRepo.get(Tool.ById(tool.id));
		expect(retrieved).not.toBeNull();
		expectEntityEqual(retrieved as Tool, updated, ["createdAt", "updatedAt"]);
	});
});

// ============================================
// P3: Empty collection
// ============================================

describe("ToolRepository empty collection", () => {
	test("get returns null for non-existent id", () => {
		expect(toolRepo.get(Tool.ById("non-existent"))).toBeNull();
	});

	test("list returns empty page", () => {
		const page = toolRepo.list(Tool.All(), { limit: 10 });
		expect(page.items).toHaveLength(0);
		expect(page.hasMore).toBe(false);
	});

	test("listAll returns empty array", () => {
		expect(toolRepo.listAll()).toHaveLength(0);
	});
});

// ============================================
// P4: Multiple elements
// ============================================

describe("ToolRepository multiple elements", () => {
	test("stores and retrieves multiple tools", () => {
		for (let i = 0; i < 3; i++) {
			toolRepo.upsert(createTestTool({ name: `Tool ${i}`, sortOrder: i }));
		}

		const page = toolRepo.list(Tool.All(), { limit: 50 });
		expect(page.items).toHaveLength(3);
	});
});

// ============================================
// P5: Delete
// ============================================

describe("ToolRepository delete", () => {
	test("deletes and confirms absence", () => {
		const tool = createTestTool();
		toolRepo.upsert(tool);

		const deleted = toolRepo.delete(Tool.ById(tool.id));
		expect(deleted).toBe(1);
		expect(toolRepo.get(Tool.ById(tool.id))).toBeNull();
	});

	test("returns 0 when nothing to delete", () => {
		expect(toolRepo.delete(Tool.ById("non-existent"))).toBe(0);
	});
});

// ============================================
// P6: Spec filtering
// ============================================

describe("ToolRepository spec filtering", () => {
	test("ById finds correct tool", () => {
		const tool = createTestTool();
		toolRepo.upsert(tool);

		const retrieved = toolRepo.get(Tool.ById(tool.id));
		expect(retrieved).not.toBeNull();
		expect(retrieved?.id).toBe(tool.id);
	});

	test("All matches all tools", () => {
		toolRepo.upsert(createTestTool({ name: "Tool A" }));
		toolRepo.upsert(createTestTool({ name: "Tool B" }));

		const page = toolRepo.list(Tool.All(), { limit: 50 });
		expect(page.items).toHaveLength(2);
	});
});

// ============================================
// P7: listAll (sorted by sortOrder)
// ============================================

describe("ToolRepository listAll", () => {
	test("returns tools sorted by sortOrder ascending", () => {
		toolRepo.upsert(createTestTool({ name: "Third", sortOrder: 3 }));
		toolRepo.upsert(createTestTool({ name: "First", sortOrder: 1 }));
		toolRepo.upsert(createTestTool({ name: "Second", sortOrder: 2 }));

		const all = toolRepo.listAll();
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
	test("executes command via shell (sh -c)", () => {
		let capturedCmd: string[] = [];
		let capturedCwd: string | undefined;

		const spawnSpy = ((opts: { cmd: string[]; cwd?: string }) => {
			capturedCmd = opts.cmd;
			capturedCwd = opts.cwd;
		}) as never;

		const repo = new ToolRepository(null as never, spawnSpy);
		repo.executeCommand("code /my/project", "/my/project");

		// Must use sh -c to support PATH-based commands (code, cursor, etc.)
		expect(capturedCmd).toEqual(["sh", "-c", "code /my/project"]);
		expect(capturedCwd).toBe("/my/project");
	});

	test("passes cwd as undefined when not provided", () => {
		let capturedCwd: string | undefined = "should-be-overwritten";

		const spawnSpy = ((opts: { cmd: string[]; cwd?: string }) => {
			capturedCwd = opts.cwd;
		}) as never;

		const repo = new ToolRepository(null as never, spawnSpy);
		repo.executeCommand("echo test");

		expect(capturedCwd).toBeUndefined();
	});
});
