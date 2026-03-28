import type { Database } from "bun:sqlite";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { createTestExecutionProcess } from "../../test/factories";
import { createTestDB } from "../../test/helpers/db";
import { expectEntityEqual } from "../../test/helpers/entity-equality";
import { seedFullChain } from "../../test/helpers/seed";
import { ExecutionProcess } from "../models/execution-process";
import { ExecutionProcessRepository } from "./execution-process-repository";

let db: Database;
let epRepo: ExecutionProcessRepository;
let SESSION_ID: string;

beforeEach(() => {
	db = createTestDB();
	epRepo = new ExecutionProcessRepository(db);

	const seed = seedFullChain(db);
	SESSION_ID = seed.session.id;
});

afterEach(() => {
	db.close();
});

// ============================================
// P1: Round-trip
// ============================================

describe("ExecutionProcessRepository round-trip", () => {
	test("preserves all fields", () => {
		const ep = createTestExecutionProcess({
			sessionId: SESSION_ID,
			runReason: "codingagent",
			status: "running",
			exitCode: null,
			completedAt: null,
		});
		epRepo.upsert(ep);

		const retrieved = epRepo.get(ExecutionProcess.ById(ep.id));
		expect(retrieved).not.toBeNull();
		expectEntityEqual(retrieved as ExecutionProcess, ep, [
			"startedAt",
			"completedAt",
			"createdAt",
			"updatedAt",
		]);
	});

	test("preserves completedAt and exitCode when set", () => {
		const completedAt = new Date();
		const ep = createTestExecutionProcess({
			sessionId: SESSION_ID,
			status: "completed",
			exitCode: 0,
			completedAt,
		});
		epRepo.upsert(ep);

		const retrieved = epRepo.get(ExecutionProcess.ById(ep.id));
		expect(retrieved).not.toBeNull();
		expect(retrieved?.exitCode).toBe(0);
		expect(retrieved?.completedAt).not.toBeNull();
		expect(
			Math.abs(
				(retrieved?.completedAt?.getTime() ?? 0) - completedAt.getTime(),
			),
		).toBeLessThan(1000);
	});

	test("preserves null completedAt and exitCode", () => {
		const ep = createTestExecutionProcess({
			sessionId: SESSION_ID,
			exitCode: null,
			completedAt: null,
		});
		epRepo.upsert(ep);

		const retrieved = epRepo.get(ExecutionProcess.ById(ep.id));
		expect(retrieved).not.toBeNull();
		expect(retrieved?.exitCode).toBeNull();
		expect(retrieved?.completedAt).toBeNull();
	});
});

// ============================================
// P2: Update round-trip
// ============================================

describe("ExecutionProcessRepository update round-trip", () => {
	test("reflects status, exitCode, completedAt changes", () => {
		const ep = createTestExecutionProcess({ sessionId: SESSION_ID });
		epRepo.upsert(ep);

		const completed = ExecutionProcess.complete(ep, "completed", 0);
		epRepo.upsert(completed);

		const retrieved = epRepo.get(ExecutionProcess.ById(ep.id));
		expect(retrieved).not.toBeNull();
		expect(retrieved?.status).toBe("completed");
		expect(retrieved?.exitCode).toBe(0);
		expect(retrieved?.completedAt).not.toBeNull();
	});
});

// ============================================
// P3: Empty collection
// ============================================

describe("ExecutionProcessRepository empty collection", () => {
	test("get returns null for non-existent id", () => {
		expect(epRepo.get(ExecutionProcess.ById("non-existent"))).toBeNull();
	});

	test("list returns empty page", () => {
		const page = epRepo.list(ExecutionProcess.BySessionId("non-existent"), {
			limit: 10,
		});
		expect(page.items).toHaveLength(0);
		expect(page.hasMore).toBe(false);
	});
});

// ============================================
// P4: Multiple elements
// ============================================

describe("ExecutionProcessRepository multiple elements", () => {
	test("stores and retrieves multiple processes", () => {
		// seedFullChain already created 1 execution process for this session
		for (let i = 0; i < 3; i++) {
			epRepo.upsert(createTestExecutionProcess({ sessionId: SESSION_ID }));
		}

		const page = epRepo.list(ExecutionProcess.BySessionId(SESSION_ID), {
			limit: 50,
		});
		expect(page.items).toHaveLength(4); // 1 from seed + 3 new
	});
});

// ============================================
// P5: Delete
// ============================================

describe("ExecutionProcessRepository delete", () => {
	test("deletes and confirms absence", () => {
		const ep = createTestExecutionProcess({ sessionId: SESSION_ID });
		epRepo.upsert(ep);

		const deleted = epRepo.delete(ExecutionProcess.ById(ep.id));
		expect(deleted).toBe(1);
		expect(epRepo.get(ExecutionProcess.ById(ep.id))).toBeNull();
	});

	test("returns 0 when nothing to delete", () => {
		expect(epRepo.delete(ExecutionProcess.ById("non-existent"))).toBe(0);
	});
});

// ============================================
// P6: Spec filtering
// ============================================

describe("ExecutionProcessRepository spec filtering", () => {
	test("ById finds correct process", () => {
		const ep = createTestExecutionProcess({ sessionId: SESSION_ID });
		epRepo.upsert(ep);

		const retrieved = epRepo.get(ExecutionProcess.ById(ep.id));
		expect(retrieved).not.toBeNull();
		expect(retrieved?.id).toBe(ep.id);
	});

	test("BySessionId filters by session", () => {
		const ep = createTestExecutionProcess({ sessionId: SESSION_ID });
		epRepo.upsert(ep);

		// seedFullChain already created 1 execution process for this session
		const page = epRepo.list(ExecutionProcess.BySessionId(SESSION_ID), {
			limit: 50,
		});
		expect(page.items).toHaveLength(2); // 1 from seed + 1 new
		expect(page.items.every((p) => p.sessionId === SESSION_ID)).toBe(true);
	});

	test("ByStatus filters by status", () => {
		// seedFullChain already created 1 running process
		const completed = createTestExecutionProcess({
			sessionId: SESSION_ID,
			status: "completed",
			exitCode: 0,
			completedAt: new Date(),
		});
		epRepo.upsert(completed);

		const page = epRepo.list(ExecutionProcess.ByStatus("completed"), {
			limit: 50,
		});
		expect(page.items).toHaveLength(1);
		expect(page.items[0].status).toBe("completed");
	});

	test("ByRunReason filters by run reason", () => {
		const agent = createTestExecutionProcess({
			sessionId: SESSION_ID,
			runReason: "codingagent",
		});
		const setup = createTestExecutionProcess({
			sessionId: SESSION_ID,
			runReason: "setupscript",
		});
		epRepo.upsert(agent);
		epRepo.upsert(setup);

		const page = epRepo.list(ExecutionProcess.ByRunReason("setupscript"), {
			limit: 50,
		});
		expect(page.items).toHaveLength(1);
		expect(page.items[0].runReason).toBe("setupscript");
	});
});
