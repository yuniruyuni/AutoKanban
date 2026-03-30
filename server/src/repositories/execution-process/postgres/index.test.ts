import { beforeEach, describe, expect, test } from "bun:test";
import { createTestExecutionProcess } from "../../../../test/factories";
import { createTestDB } from "../../../../test/helpers/db";
import { expectEntityEqual } from "../../../../test/helpers/entity-equality";
import { seedFullChain } from "../../../../test/helpers/seed";
import type { Database } from "../../../infra/db/database";
import { ExecutionProcess } from "../../../models/execution-process";
import type { DbReadCtx, DbWriteCtx } from "../../common";
import { createDbReadCtx, createDbWriteCtx } from "../../common";
import { ExecutionProcessRepository } from ".";

let db: Database;
let epRepo: ExecutionProcessRepository;
let rCtx: DbReadCtx;
let wCtx: DbWriteCtx;
let SESSION_ID: string;

beforeEach(async () => {
	db = await createTestDB();
	epRepo = new ExecutionProcessRepository();
	rCtx = createDbReadCtx(db);
	wCtx = createDbWriteCtx(db);

	const seed = await seedFullChain(db);
	SESSION_ID = seed.session.id;
});

// ============================================
// P1: Round-trip
// ============================================

describe("ExecutionProcessRepository round-trip", () => {
	test("preserves all fields", async () => {
		const ep = createTestExecutionProcess({
			sessionId: SESSION_ID,
			runReason: "codingagent",
			status: "running",
			exitCode: null,
			completedAt: null,
		});
		await epRepo.upsert(wCtx, ep);

		const retrieved = await epRepo.get(rCtx, ExecutionProcess.ById(ep.id));
		expect(retrieved).not.toBeNull();
		expectEntityEqual(retrieved as ExecutionProcess, ep, [
			"startedAt",
			"completedAt",
			"createdAt",
			"updatedAt",
		]);
	});

	test("preserves completedAt and exitCode when set", async () => {
		const completedAt = new Date();
		const ep = createTestExecutionProcess({
			sessionId: SESSION_ID,
			status: "completed",
			exitCode: 0,
			completedAt,
		});
		await epRepo.upsert(wCtx, ep);

		const retrieved = await epRepo.get(rCtx, ExecutionProcess.ById(ep.id));
		expect(retrieved).not.toBeNull();
		expect(retrieved?.exitCode).toBe(0);
		expect(retrieved?.completedAt).not.toBeNull();
		expect(
			Math.abs(
				(retrieved?.completedAt?.getTime() ?? 0) - completedAt.getTime(),
			),
		).toBeLessThan(1000);
	});

	test("preserves null completedAt and exitCode", async () => {
		const ep = createTestExecutionProcess({
			sessionId: SESSION_ID,
			exitCode: null,
			completedAt: null,
		});
		await epRepo.upsert(wCtx, ep);

		const retrieved = await epRepo.get(rCtx, ExecutionProcess.ById(ep.id));
		expect(retrieved).not.toBeNull();
		expect(retrieved?.exitCode).toBeNull();
		expect(retrieved?.completedAt).toBeNull();
	});
});

// ============================================
// P2: Update round-trip
// ============================================

describe("ExecutionProcessRepository update round-trip", () => {
	test("reflects status, exitCode, completedAt changes", async () => {
		const ep = createTestExecutionProcess({ sessionId: SESSION_ID });
		await epRepo.upsert(wCtx, ep);

		const completed = ExecutionProcess.complete(ep, "completed", 0);
		await epRepo.upsert(wCtx, completed);

		const retrieved = await epRepo.get(rCtx, ExecutionProcess.ById(ep.id));
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
	test("get returns null for non-existent id", async () => {
		expect(
			await epRepo.get(rCtx, ExecutionProcess.ById("non-existent")),
		).toBeNull();
	});

	test("list returns empty page", async () => {
		const page = await epRepo.list(
			rCtx,
			ExecutionProcess.BySessionId("non-existent"),
			{
				limit: 10,
			},
		);
		expect(page.items).toHaveLength(0);
		expect(page.hasMore).toBe(false);
	});
});

// ============================================
// P4: Multiple elements
// ============================================

describe("ExecutionProcessRepository multiple elements", () => {
	test("stores and retrieves multiple processes", async () => {
		// seedFullChain already created 1 execution process for this session
		for (let i = 0; i < 3; i++) {
			await epRepo.upsert(
				wCtx,
				createTestExecutionProcess({ sessionId: SESSION_ID }),
			);
		}

		const page = await epRepo.list(
			rCtx,
			ExecutionProcess.BySessionId(SESSION_ID),
			{
				limit: 50,
			},
		);
		expect(page.items).toHaveLength(4); // 1 from seed + 3 new
	});
});

// ============================================
// P5: Delete
// ============================================

describe("ExecutionProcessRepository delete", () => {
	test("deletes and confirms absence", async () => {
		const ep = createTestExecutionProcess({ sessionId: SESSION_ID });
		await epRepo.upsert(wCtx, ep);

		const deleted = await epRepo.delete(wCtx, ExecutionProcess.ById(ep.id));
		expect(deleted).toBe(1);
		expect(await epRepo.get(rCtx, ExecutionProcess.ById(ep.id))).toBeNull();
	});

	test("returns 0 when nothing to delete", async () => {
		expect(
			await epRepo.delete(wCtx, ExecutionProcess.ById("non-existent")),
		).toBe(0);
	});
});

// ============================================
// P6: Spec filtering
// ============================================

describe("ExecutionProcessRepository spec filtering", () => {
	test("ById finds correct process", async () => {
		const ep = createTestExecutionProcess({ sessionId: SESSION_ID });
		await epRepo.upsert(wCtx, ep);

		const retrieved = await epRepo.get(rCtx, ExecutionProcess.ById(ep.id));
		expect(retrieved).not.toBeNull();
		expect(retrieved?.id).toBe(ep.id);
	});

	test("BySessionId filters by session", async () => {
		const ep = createTestExecutionProcess({ sessionId: SESSION_ID });
		await epRepo.upsert(wCtx, ep);

		// seedFullChain already created 1 execution process for this session
		const page = await epRepo.list(
			rCtx,
			ExecutionProcess.BySessionId(SESSION_ID),
			{
				limit: 50,
			},
		);
		expect(page.items).toHaveLength(2); // 1 from seed + 1 new
		expect(page.items.every((p) => p.sessionId === SESSION_ID)).toBe(true);
	});

	test("ByStatus filters by status", async () => {
		// seedFullChain already created 1 running process
		const completed = createTestExecutionProcess({
			sessionId: SESSION_ID,
			status: "completed",
			exitCode: 0,
			completedAt: new Date(),
		});
		await epRepo.upsert(wCtx, completed);

		const page = await epRepo.list(
			rCtx,
			ExecutionProcess.ByStatus("completed"),
			{
				limit: 50,
			},
		);
		expect(page.items).toHaveLength(1);
		expect(page.items[0].status).toBe("completed");
	});

	test("ByRunReason filters by run reason", async () => {
		const agent = createTestExecutionProcess({
			sessionId: SESSION_ID,
			runReason: "codingagent",
		});
		const setup = createTestExecutionProcess({
			sessionId: SESSION_ID,
			runReason: "setupscript",
		});
		await epRepo.upsert(wCtx, agent);
		await epRepo.upsert(wCtx, setup);

		const page = await epRepo.list(
			rCtx,
			ExecutionProcess.ByRunReason("setupscript"),
			{
				limit: 50,
			},
		);
		expect(page.items).toHaveLength(1);
		expect(page.items[0].runReason).toBe("setupscript");
	});
});
