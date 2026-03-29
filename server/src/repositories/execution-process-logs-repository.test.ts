import type { Database } from "bun:sqlite";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { createTestExecutionProcessLogs } from "../../test/factories";
import { createTestDB } from "../../test/helpers/db";
import { seedFullChain } from "../../test/helpers/seed";
import { ExecutionProcessLogsRepository } from "./execution-process-logs";

let db: Database;
let logsRepo: ExecutionProcessLogsRepository;
let EXECUTION_PROCESS_ID: string;

beforeEach(() => {
	db = createTestDB();
	logsRepo = new ExecutionProcessLogsRepository(db);

	const seed = seedFullChain(db);
	EXECUTION_PROCESS_ID = seed.executionProcess.id;
});

afterEach(() => {
	db.close();
});

// ============================================
// P1: Round-trip
// ============================================

describe("ExecutionProcessLogsRepository round-trip", () => {
	test("upsertLogs and getLogs preserves data", () => {
		const logs = createTestExecutionProcessLogs({
			executionProcessId: EXECUTION_PROCESS_ID,
			logs: "line1\nline2\nline3",
		});
		logsRepo.upsertLogs(logs);

		const retrieved = logsRepo.getLogs(EXECUTION_PROCESS_ID);
		expect(retrieved).not.toBeNull();
		expect(retrieved?.executionProcessId).toBe(EXECUTION_PROCESS_ID);
		expect(retrieved?.logs).toBe("line1\nline2\nline3");
	});

	test("preserves empty string logs", () => {
		const logs = createTestExecutionProcessLogs({
			executionProcessId: EXECUTION_PROCESS_ID,
			logs: "",
		});
		logsRepo.upsertLogs(logs);

		const retrieved = logsRepo.getLogs(EXECUTION_PROCESS_ID);
		expect(retrieved).not.toBeNull();
		expect(retrieved?.logs).toBe("");
	});
});

// ============================================
// P2: Update round-trip (upsertLogs overwrites)
// ============================================

describe("ExecutionProcessLogsRepository update round-trip", () => {
	test("upsertLogs overwrites existing logs", () => {
		logsRepo.upsertLogs(
			createTestExecutionProcessLogs({
				executionProcessId: EXECUTION_PROCESS_ID,
				logs: "original",
			}),
		);

		logsRepo.upsertLogs(
			createTestExecutionProcessLogs({
				executionProcessId: EXECUTION_PROCESS_ID,
				logs: "replaced",
			}),
		);

		const retrieved = logsRepo.getLogs(EXECUTION_PROCESS_ID);
		expect(retrieved?.logs).toBe("replaced");
	});
});

// ============================================
// P3: Empty collection
// ============================================

describe("ExecutionProcessLogsRepository empty collection", () => {
	test("getLogs returns null for non-existent id", () => {
		expect(logsRepo.getLogs("non-existent")).toBeNull();
	});
});

// ============================================
// P7: appendLogs
// ============================================

describe("ExecutionProcessLogsRepository appendLogs", () => {
	test("appends to existing logs", () => {
		logsRepo.upsertLogs(
			createTestExecutionProcessLogs({
				executionProcessId: EXECUTION_PROCESS_ID,
				logs: "first",
			}),
		);

		logsRepo.appendLogs(EXECUTION_PROCESS_ID, "-second");

		const retrieved = logsRepo.getLogs(EXECUTION_PROCESS_ID);
		expect(retrieved?.logs).toBe("first-second");
	});

	test("appends to empty table (INSERT side)", () => {
		logsRepo.appendLogs(EXECUTION_PROCESS_ID, "initial-logs");

		const retrieved = logsRepo.getLogs(EXECUTION_PROCESS_ID);
		expect(retrieved).not.toBeNull();
		expect(retrieved?.logs).toBe("initial-logs");
	});

	test("multiple appends concatenate correctly", () => {
		logsRepo.appendLogs(EXECUTION_PROCESS_ID, "A");
		logsRepo.appendLogs(EXECUTION_PROCESS_ID, "B");
		logsRepo.appendLogs(EXECUTION_PROCESS_ID, "C");

		const retrieved = logsRepo.getLogs(EXECUTION_PROCESS_ID);
		expect(retrieved?.logs).toBe("ABC");
	});
});
