import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { createTestExecutionProcessLogs } from "../../../../test/factories";
import { closeTestDB, createTestDB } from "../../../../test/helpers/db";
import { seedFullChain } from "../../../../test/helpers/seed";
import type { Database } from "../../../infra/db/database";
import type { DbReadCtx, DbWriteCtx } from "../../common";
import { createDbReadCtx, createDbWriteCtx } from "../../common";
import { ExecutionProcessLogsRepository } from ".";

let db: Database;
let logsRepo: ExecutionProcessLogsRepository;
let rCtx: DbReadCtx;
let wCtx: DbWriteCtx;
let EXECUTION_PROCESS_ID: string;

beforeEach(async () => {
	db = await createTestDB();
	logsRepo = new ExecutionProcessLogsRepository();
	rCtx = createDbReadCtx(db);
	wCtx = createDbWriteCtx(db);

	const seed = await seedFullChain(db);
	EXECUTION_PROCESS_ID = seed.executionProcess.id;
});

afterEach(async () => {
	await closeTestDB(db);
});

// ============================================
// P1: Round-trip
// ============================================

describe("ExecutionProcessLogsRepository round-trip", () => {
	test("upsertLogs and getLogs preserves data", async () => {
		const logs = createTestExecutionProcessLogs({
			executionProcessId: EXECUTION_PROCESS_ID,
			logs: "line1\nline2\nline3",
		});
		await logsRepo.upsertLogs(wCtx, logs);

		const retrieved = await logsRepo.getLogs(rCtx, EXECUTION_PROCESS_ID);
		expect(retrieved).not.toBeNull();
		expect(retrieved?.executionProcessId).toBe(EXECUTION_PROCESS_ID);
		expect(retrieved?.logs).toBe("line1\nline2\nline3");
	});

	test("preserves empty string logs", async () => {
		const logs = createTestExecutionProcessLogs({
			executionProcessId: EXECUTION_PROCESS_ID,
			logs: "",
		});
		await logsRepo.upsertLogs(wCtx, logs);

		const retrieved = await logsRepo.getLogs(rCtx, EXECUTION_PROCESS_ID);
		expect(retrieved).not.toBeNull();
		expect(retrieved?.logs).toBe("");
	});
});

// ============================================
// P2: Update round-trip (upsertLogs overwrites)
// ============================================

describe("ExecutionProcessLogsRepository update round-trip", () => {
	test("upsertLogs overwrites existing logs", async () => {
		await logsRepo.upsertLogs(
			wCtx,
			createTestExecutionProcessLogs({
				executionProcessId: EXECUTION_PROCESS_ID,
				logs: "original",
			}),
		);

		await logsRepo.upsertLogs(
			wCtx,
			createTestExecutionProcessLogs({
				executionProcessId: EXECUTION_PROCESS_ID,
				logs: "replaced",
			}),
		);

		const retrieved = await logsRepo.getLogs(rCtx, EXECUTION_PROCESS_ID);
		expect(retrieved?.logs).toBe("replaced");
	});
});

// ============================================
// P3: Empty collection
// ============================================

describe("ExecutionProcessLogsRepository empty collection", () => {
	test("getLogs returns null for non-existent id", async () => {
		expect(await logsRepo.getLogs(rCtx, "non-existent")).toBeNull();
	});
});

// ============================================
// P7: appendLogs
// ============================================

describe("ExecutionProcessLogsRepository appendLogs", () => {
	test("appends to existing logs", async () => {
		await logsRepo.upsertLogs(
			wCtx,
			createTestExecutionProcessLogs({
				executionProcessId: EXECUTION_PROCESS_ID,
				logs: "first",
			}),
		);

		await logsRepo.appendLogs(wCtx, EXECUTION_PROCESS_ID, "-second");

		const retrieved = await logsRepo.getLogs(rCtx, EXECUTION_PROCESS_ID);
		expect(retrieved?.logs).toBe("first-second");
	});

	test("appends to empty table (INSERT side)", async () => {
		await logsRepo.appendLogs(wCtx, EXECUTION_PROCESS_ID, "initial-logs");

		const retrieved = await logsRepo.getLogs(rCtx, EXECUTION_PROCESS_ID);
		expect(retrieved).not.toBeNull();
		expect(retrieved?.logs).toBe("initial-logs");
	});

	test("multiple appends concatenate correctly", async () => {
		await logsRepo.appendLogs(wCtx, EXECUTION_PROCESS_ID, "A");
		await logsRepo.appendLogs(wCtx, EXECUTION_PROCESS_ID, "B");
		await logsRepo.appendLogs(wCtx, EXECUTION_PROCESS_ID, "C");

		const retrieved = await logsRepo.getLogs(rCtx, EXECUTION_PROCESS_ID);
		expect(retrieved?.logs).toBe("ABC");
	});
});
