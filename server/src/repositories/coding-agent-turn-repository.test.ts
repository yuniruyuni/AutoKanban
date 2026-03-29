import type { Database } from "bun:sqlite";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
	createTestCodingAgentTurn,
	createTestExecutionProcess,
} from "../../test/factories";
import { createTestDB } from "../../test/helpers/db";
import { expectEntityEqual } from "../../test/helpers/entity-equality";
import { seedFullChain } from "../../test/helpers/seed";
import { CodingAgentTurn } from "../models/coding-agent-turn";
import { CodingAgentTurnRepository } from "./coding-agent-turn";
import { ExecutionProcessRepository } from "./execution-process";
import { SessionRepository } from "./session";

let db: Database;
let turnRepo: CodingAgentTurnRepository;
let EXECUTION_PROCESS_ID: string;
let SESSION_ID: string;
let WORKSPACE_ID: string;

beforeEach(() => {
	db = createTestDB();
	turnRepo = new CodingAgentTurnRepository(db);

	const seed = seedFullChain(db);
	EXECUTION_PROCESS_ID = seed.executionProcess.id;
	SESSION_ID = seed.session.id;
	WORKSPACE_ID = seed.workspace.id;
});

afterEach(() => {
	db.close();
});

// ============================================
// P1: Round-trip
// ============================================

describe("CodingAgentTurnRepository round-trip", () => {
	test("preserves all fields", () => {
		const turn = createTestCodingAgentTurn({
			executionProcessId: EXECUTION_PROCESS_ID,
			agentSessionId: "session-abc",
			agentMessageId: "msg-123",
			prompt: "implement feature X",
			summary: "Feature X implemented",
			seen: true,
		});
		turnRepo.upsert(turn);

		const retrieved = turnRepo.get(CodingAgentTurn.ById(turn.id));
		expect(retrieved).not.toBeNull();
		expectEntityEqual(retrieved as CodingAgentTurn, turn, [
			"createdAt",
			"updatedAt",
		]);
	});

	test("preserves null fields", () => {
		const turn = createTestCodingAgentTurn({
			executionProcessId: EXECUTION_PROCESS_ID,
			agentSessionId: null,
			agentMessageId: null,
			prompt: null,
			summary: null,
			seen: false,
		});
		turnRepo.upsert(turn);

		const retrieved = turnRepo.get(CodingAgentTurn.ById(turn.id));
		expect(retrieved).not.toBeNull();
		expect(retrieved?.agentSessionId).toBeNull();
		expect(retrieved?.agentMessageId).toBeNull();
		expect(retrieved?.prompt).toBeNull();
		expect(retrieved?.summary).toBeNull();
		expect(retrieved?.seen).toBe(false);
	});

	test("preserves seen=true", () => {
		const turn = createTestCodingAgentTurn({
			executionProcessId: EXECUTION_PROCESS_ID,
			seen: true,
		});
		turnRepo.upsert(turn);

		const retrieved = turnRepo.get(CodingAgentTurn.ById(turn.id));
		expect(retrieved).not.toBeNull();
		expect(retrieved?.seen).toBe(true);
	});
});

// ============================================
// P2: Update round-trip
// ============================================

describe("CodingAgentTurnRepository update round-trip", () => {
	test("reflects all changed fields", () => {
		const turn = createTestCodingAgentTurn({
			executionProcessId: EXECUTION_PROCESS_ID,
		});
		turnRepo.upsert(turn);

		const updated: CodingAgentTurn = {
			...turn,
			agentSessionId: "updated-session",
			agentMessageId: "updated-msg",
			prompt: "updated prompt",
			summary: "updated summary",
			seen: true,
			updatedAt: new Date(),
		};
		turnRepo.upsert(updated);

		const retrieved = turnRepo.get(CodingAgentTurn.ById(turn.id));
		expect(retrieved).not.toBeNull();
		expectEntityEqual(retrieved as CodingAgentTurn, updated, [
			"createdAt",
			"updatedAt",
		]);
	});
});

// ============================================
// P3: Empty collection
// ============================================

describe("CodingAgentTurnRepository empty collection", () => {
	test("get returns null for non-existent id", () => {
		expect(turnRepo.get(CodingAgentTurn.ById("non-existent"))).toBeNull();
	});

	test("list returns empty page", () => {
		const page = turnRepo.list(
			CodingAgentTurn.ByExecutionProcessId("non-existent"),
			{ limit: 10 },
		);
		expect(page.items).toHaveLength(0);
		expect(page.hasMore).toBe(false);
	});
});

// ============================================
// P4: Multiple elements
// ============================================

describe("CodingAgentTurnRepository multiple elements", () => {
	test("stores and retrieves multiple turns", () => {
		// Need multiple execution processes (unique FK constraint)
		const _sessionRepo = new SessionRepository(db);
		const epRepo = new ExecutionProcessRepository(db);

		const ep1 = createTestExecutionProcess({ sessionId: SESSION_ID });
		const ep2 = createTestExecutionProcess({ sessionId: SESSION_ID });
		const ep3 = createTestExecutionProcess({ sessionId: SESSION_ID });
		epRepo.upsert(ep1);
		epRepo.upsert(ep2);
		epRepo.upsert(ep3);

		turnRepo.upsert(createTestCodingAgentTurn({ executionProcessId: ep1.id }));
		turnRepo.upsert(createTestCodingAgentTurn({ executionProcessId: ep2.id }));
		turnRepo.upsert(createTestCodingAgentTurn({ executionProcessId: ep3.id }));

		// Use HasAgentSessionId (defaults to null, so use All-like query)
		const page = turnRepo.list(CodingAgentTurn.ByExecutionProcessId(ep1.id), {
			limit: 50,
		});
		expect(page.items).toHaveLength(1);
	});
});

// ============================================
// P5: Delete
// ============================================

describe("CodingAgentTurnRepository delete", () => {
	test("deletes and confirms absence", () => {
		const turn = createTestCodingAgentTurn({
			executionProcessId: EXECUTION_PROCESS_ID,
		});
		turnRepo.upsert(turn);

		const deleted = turnRepo.delete(CodingAgentTurn.ById(turn.id));
		expect(deleted).toBe(1);
		expect(turnRepo.get(CodingAgentTurn.ById(turn.id))).toBeNull();
	});

	test("returns 0 when nothing to delete", () => {
		expect(turnRepo.delete(CodingAgentTurn.ById("non-existent"))).toBe(0);
	});
});

// ============================================
// P6: Spec filtering
// ============================================

describe("CodingAgentTurnRepository spec filtering", () => {
	test("ById finds correct turn", () => {
		const turn = createTestCodingAgentTurn({
			executionProcessId: EXECUTION_PROCESS_ID,
		});
		turnRepo.upsert(turn);

		const retrieved = turnRepo.get(CodingAgentTurn.ById(turn.id));
		expect(retrieved).not.toBeNull();
		expect(retrieved?.id).toBe(turn.id);
	});

	test("ByExecutionProcessId filters correctly", () => {
		const turn = createTestCodingAgentTurn({
			executionProcessId: EXECUTION_PROCESS_ID,
		});
		turnRepo.upsert(turn);

		const retrieved = turnRepo.get(
			CodingAgentTurn.ByExecutionProcessId(EXECUTION_PROCESS_ID),
		);
		expect(retrieved).not.toBeNull();
		expect(retrieved?.executionProcessId).toBe(EXECUTION_PROCESS_ID);
	});

	test("ByAgentSessionId filters correctly", () => {
		const turn = createTestCodingAgentTurn({
			executionProcessId: EXECUTION_PROCESS_ID,
			agentSessionId: "unique-session",
		});
		turnRepo.upsert(turn);

		const retrieved = turnRepo.get(
			CodingAgentTurn.ByAgentSessionId("unique-session"),
		);
		expect(retrieved).not.toBeNull();
		expect(retrieved?.agentSessionId).toBe("unique-session");
	});

	test("HasAgentSessionId filters turns with non-null agent session", () => {
		const epRepo = new ExecutionProcessRepository(db);
		const ep2 = createTestExecutionProcess({ sessionId: SESSION_ID });
		epRepo.upsert(ep2);

		const turnWith = createTestCodingAgentTurn({
			executionProcessId: EXECUTION_PROCESS_ID,
			agentSessionId: "has-session",
		});
		const turnWithout = createTestCodingAgentTurn({
			executionProcessId: ep2.id,
			agentSessionId: null,
		});
		turnRepo.upsert(turnWith);
		turnRepo.upsert(turnWithout);

		const page = turnRepo.list(CodingAgentTurn.HasAgentSessionId(), {
			limit: 50,
		});
		expect(page.items).toHaveLength(1);
		expect(page.items[0].agentSessionId).toBe("has-session");
	});
});

// ============================================
// P7: Custom methods
// ============================================

describe("CodingAgentTurnRepository updateAgentSessionId", () => {
	test("updates only agent session id", () => {
		const turn = createTestCodingAgentTurn({
			executionProcessId: EXECUTION_PROCESS_ID,
			agentSessionId: null,
		});
		turnRepo.upsert(turn);

		turnRepo.updateAgentSessionId(EXECUTION_PROCESS_ID, "new-agent-session");

		const retrieved = turnRepo.get(CodingAgentTurn.ById(turn.id));
		expect(retrieved).not.toBeNull();
		expect(retrieved?.agentSessionId).toBe("new-agent-session");
		// Other fields should remain unchanged
		expect(retrieved?.prompt).toBe(turn.prompt);
	});
});

describe("CodingAgentTurnRepository updateAgentMessageId", () => {
	test("updates only agent message id", () => {
		const turn = createTestCodingAgentTurn({
			executionProcessId: EXECUTION_PROCESS_ID,
			agentMessageId: null,
		});
		turnRepo.upsert(turn);

		turnRepo.updateAgentMessageId(EXECUTION_PROCESS_ID, "new-msg-id");

		const retrieved = turnRepo.get(CodingAgentTurn.ById(turn.id));
		expect(retrieved).not.toBeNull();
		expect(retrieved?.agentMessageId).toBe("new-msg-id");
		expect(retrieved?.prompt).toBe(turn.prompt);
	});
});

describe("CodingAgentTurnRepository updateSummary", () => {
	test("updates only summary", () => {
		const turn = createTestCodingAgentTurn({
			executionProcessId: EXECUTION_PROCESS_ID,
			summary: null,
		});
		turnRepo.upsert(turn);

		turnRepo.updateSummary(EXECUTION_PROCESS_ID, "Task completed successfully");

		const retrieved = turnRepo.get(CodingAgentTurn.ById(turn.id));
		expect(retrieved).not.toBeNull();
		expect(retrieved?.summary).toBe("Task completed successfully");
		expect(retrieved?.prompt).toBe(turn.prompt);
	});
});

describe("CodingAgentTurnRepository findLatestResumeInfo", () => {
	test("returns resume info for session with agent session", () => {
		const turn = createTestCodingAgentTurn({
			executionProcessId: EXECUTION_PROCESS_ID,
			agentSessionId: "resume-session",
			agentMessageId: "resume-msg",
		});
		turnRepo.upsert(turn);

		const info = turnRepo.findLatestResumeInfo(SESSION_ID);
		expect(info).not.toBeNull();
		expect(info?.agentSessionId).toBe("resume-session");
		expect(info?.agentMessageId).toBe("resume-msg");
	});

	test("returns null when no turns have agent session id", () => {
		const turn = createTestCodingAgentTurn({
			executionProcessId: EXECUTION_PROCESS_ID,
			agentSessionId: null,
		});
		turnRepo.upsert(turn);

		expect(turnRepo.findLatestResumeInfo(SESSION_ID)).toBeNull();
	});

	test("returns null for non-existent session", () => {
		expect(turnRepo.findLatestResumeInfo("non-existent")).toBeNull();
	});
});

describe("CodingAgentTurnRepository findLatestResumeInfoByWorkspaceId", () => {
	test("returns resume info across workspace sessions (3-table JOIN)", () => {
		const turn = createTestCodingAgentTurn({
			executionProcessId: EXECUTION_PROCESS_ID,
			agentSessionId: "ws-resume-session",
			agentMessageId: "ws-resume-msg",
		});
		turnRepo.upsert(turn);

		const info = turnRepo.findLatestResumeInfoByWorkspaceId(WORKSPACE_ID);
		expect(info).not.toBeNull();
		expect(info?.agentSessionId).toBe("ws-resume-session");
		expect(info?.agentMessageId).toBe("ws-resume-msg");
	});

	test("returns null for workspace with no agent sessions", () => {
		expect(turnRepo.findLatestResumeInfoByWorkspaceId(WORKSPACE_ID)).toBeNull();
	});

	test("returns null for non-existent workspace", () => {
		expect(
			turnRepo.findLatestResumeInfoByWorkspaceId("non-existent"),
		).toBeNull();
	});
});
