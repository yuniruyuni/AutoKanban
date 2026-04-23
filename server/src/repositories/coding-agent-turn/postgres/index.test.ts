import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
	createTestCodingAgentProcess,
	createTestCodingAgentTurn,
} from "../../../../test/factories";
import { closeTestDB, createTestDB } from "../../../../test/helpers/db";
import { expectEntityEqual } from "../../../../test/helpers/entity-equality";
import { seedFullChain } from "../../../../test/helpers/seed";
import type { Database } from "../../../infra/db/database";
import { CodingAgentTurn } from "../../../models/coding-agent-turn";
import { CodingAgentProcessRepository } from "../../coding-agent-process/postgres";
import type { DbReadCtx, DbWriteCtx } from "../../common";
import { createDbReadCtx, createDbWriteCtx } from "../../common";
import { SessionRepository } from "../../session/postgres";
import { CodingAgentTurnRepository } from ".";

let db: Database;
let turnRepo: CodingAgentTurnRepository;
let rCtx: DbReadCtx;
let wCtx: DbWriteCtx;
let EXECUTION_PROCESS_ID: string;
let SESSION_ID: string;
let WORKSPACE_ID: string;

/** Mark the seeded coding agent process as completed so resume-info queries can find it. */
async function markCodingAgentProcessCompleted(): Promise<void> {
	const capRepo = new CodingAgentProcessRepository();
	const cap = await capRepo.get(rCtx, {
		type: "ById",
		id: EXECUTION_PROCESS_ID,
	} as never);
	if (cap) {
		await capRepo.upsert(wCtx, {
			...cap,
			status: "completed" as const,
			completedAt: new Date(),
		});
	}
}

beforeEach(async () => {
	db = await createTestDB();
	turnRepo = new CodingAgentTurnRepository();
	rCtx = createDbReadCtx(db);
	wCtx = createDbWriteCtx(db);

	const seed = await seedFullChain(db);
	EXECUTION_PROCESS_ID = seed.executionProcess.id;
	SESSION_ID = seed.session.id;
	WORKSPACE_ID = seed.workspace.id;
});

afterEach(async () => {
	await closeTestDB(db);
});

// ============================================
// P1: Round-trip
// ============================================

describe("CodingAgentTurnRepository round-trip", () => {
	test("preserves all fields", async () => {
		const turn = createTestCodingAgentTurn({
			executionProcessId: EXECUTION_PROCESS_ID,
			agentSessionId: "session-abc",
			agentMessageId: "msg-123",
			prompt: "implement feature X",
			summary: "Feature X implemented",
			seen: true,
		});
		await turnRepo.upsert(wCtx, turn);

		const retrieved = await turnRepo.get(rCtx, CodingAgentTurn.ById(turn.id));
		expect(retrieved).not.toBeNull();
		expectEntityEqual(retrieved as CodingAgentTurn, turn, [
			"createdAt",
			"updatedAt",
		]);
	});

	test("preserves null fields", async () => {
		const turn = createTestCodingAgentTurn({
			executionProcessId: EXECUTION_PROCESS_ID,
			agentSessionId: null,
			agentMessageId: null,
			prompt: null,
			summary: null,
			seen: false,
		});
		await turnRepo.upsert(wCtx, turn);

		const retrieved = await turnRepo.get(rCtx, CodingAgentTurn.ById(turn.id));
		expect(retrieved).not.toBeNull();
		expect(retrieved?.agentSessionId).toBeNull();
		expect(retrieved?.agentMessageId).toBeNull();
		expect(retrieved?.prompt).toBeNull();
		expect(retrieved?.summary).toBeNull();
		expect(retrieved?.seen).toBe(false);
	});

	test("preserves seen=true", async () => {
		const turn = createTestCodingAgentTurn({
			executionProcessId: EXECUTION_PROCESS_ID,
			seen: true,
		});
		await turnRepo.upsert(wCtx, turn);

		const retrieved = await turnRepo.get(rCtx, CodingAgentTurn.ById(turn.id));
		expect(retrieved).not.toBeNull();
		expect(retrieved?.seen).toBe(true);
	});
});

// ============================================
// P2: Update round-trip
// ============================================

describe("CodingAgentTurnRepository update round-trip", () => {
	test("reflects all changed fields", async () => {
		const turn = createTestCodingAgentTurn({
			executionProcessId: EXECUTION_PROCESS_ID,
		});
		await turnRepo.upsert(wCtx, turn);

		const updated: CodingAgentTurn = {
			...turn,
			agentSessionId: "updated-session",
			agentMessageId: "updated-msg",
			prompt: "updated prompt",
			summary: "updated summary",
			seen: true,
			updatedAt: new Date(),
		};
		await turnRepo.upsert(wCtx, updated);

		const retrieved = await turnRepo.get(rCtx, CodingAgentTurn.ById(turn.id));
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
	test("get returns null for non-existent id", async () => {
		expect(
			await turnRepo.get(rCtx, CodingAgentTurn.ById("non-existent")),
		).toBeNull();
	});

	test("list returns empty page", async () => {
		const page = await turnRepo.list(
			rCtx,
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
	test("stores and retrieves multiple turns", async () => {
		// Need multiple coding agent processes (unique FK constraint)
		const _sessionRepo = new SessionRepository();
		const capRepo = new CodingAgentProcessRepository();

		const ep1 = createTestCodingAgentProcess({ sessionId: SESSION_ID });
		const ep2 = createTestCodingAgentProcess({ sessionId: SESSION_ID });
		const ep3 = createTestCodingAgentProcess({ sessionId: SESSION_ID });
		await capRepo.upsert(wCtx, ep1);
		await capRepo.upsert(wCtx, ep2);
		await capRepo.upsert(wCtx, ep3);

		await turnRepo.upsert(
			wCtx,
			createTestCodingAgentTurn({ executionProcessId: ep1.id }),
		);
		await turnRepo.upsert(
			wCtx,
			createTestCodingAgentTurn({ executionProcessId: ep2.id }),
		);
		await turnRepo.upsert(
			wCtx,
			createTestCodingAgentTurn({ executionProcessId: ep3.id }),
		);

		// Use HasAgentSessionId (defaults to null, so use All-like query)
		const page = await turnRepo.list(
			rCtx,
			CodingAgentTurn.ByExecutionProcessId(ep1.id),
			{
				limit: 50,
			},
		);
		expect(page.items).toHaveLength(1);
	});
});

// ============================================
// P5: Delete
// ============================================

describe("CodingAgentTurnRepository delete", () => {
	test("deletes and confirms absence", async () => {
		const turn = createTestCodingAgentTurn({
			executionProcessId: EXECUTION_PROCESS_ID,
		});
		await turnRepo.upsert(wCtx, turn);

		const deleted = await turnRepo.delete(wCtx, CodingAgentTurn.ById(turn.id));
		expect(deleted).toBe(1);
		expect(await turnRepo.get(rCtx, CodingAgentTurn.ById(turn.id))).toBeNull();
	});

	test("returns 0 when nothing to delete", async () => {
		expect(
			await turnRepo.delete(wCtx, CodingAgentTurn.ById("non-existent")),
		).toBe(0);
	});
});

// ============================================
// P6: Spec filtering
// ============================================

describe("CodingAgentTurnRepository spec filtering", () => {
	test("ById finds correct turn", async () => {
		const turn = createTestCodingAgentTurn({
			executionProcessId: EXECUTION_PROCESS_ID,
		});
		await turnRepo.upsert(wCtx, turn);

		const retrieved = await turnRepo.get(rCtx, CodingAgentTurn.ById(turn.id));
		expect(retrieved).not.toBeNull();
		expect(retrieved?.id).toBe(turn.id);
	});

	test("ByExecutionProcessId filters correctly", async () => {
		const turn = createTestCodingAgentTurn({
			executionProcessId: EXECUTION_PROCESS_ID,
		});
		await turnRepo.upsert(wCtx, turn);

		const retrieved = await turnRepo.get(
			rCtx,
			CodingAgentTurn.ByExecutionProcessId(EXECUTION_PROCESS_ID),
		);
		expect(retrieved).not.toBeNull();
		expect(retrieved?.executionProcessId).toBe(EXECUTION_PROCESS_ID);
	});

	test("ByAgentSessionId filters correctly", async () => {
		const turn = createTestCodingAgentTurn({
			executionProcessId: EXECUTION_PROCESS_ID,
			agentSessionId: "unique-session",
		});
		await turnRepo.upsert(wCtx, turn);

		const retrieved = await turnRepo.get(
			rCtx,
			CodingAgentTurn.ByAgentSessionId("unique-session"),
		);
		expect(retrieved).not.toBeNull();
		expect(retrieved?.agentSessionId).toBe("unique-session");
	});

	test("HasAgentSessionId filters turns with non-null agent session", async () => {
		const capRepo = new CodingAgentProcessRepository();
		const ep2 = createTestCodingAgentProcess({ sessionId: SESSION_ID });
		await capRepo.upsert(wCtx, ep2);

		const turnWith = createTestCodingAgentTurn({
			executionProcessId: EXECUTION_PROCESS_ID,
			agentSessionId: "has-session",
		});
		const turnWithout = createTestCodingAgentTurn({
			executionProcessId: ep2.id,
			agentSessionId: null,
		});
		await turnRepo.upsert(wCtx, turnWith);
		await turnRepo.upsert(wCtx, turnWithout);

		const page = await turnRepo.list(
			rCtx,
			CodingAgentTurn.HasAgentSessionId(),
			{
				limit: 50,
			},
		);
		expect(page.items).toHaveLength(1);
		expect(page.items[0].agentSessionId).toBe("has-session");
	});
});

// ============================================
// P7: Custom methods
// ============================================

describe("CodingAgentTurnRepository upsert with model helpers", () => {
	test("updates agent session id via withAgentSessionId + upsert", async () => {
		const turn = createTestCodingAgentTurn({
			executionProcessId: EXECUTION_PROCESS_ID,
			agentSessionId: null,
		});
		await turnRepo.upsert(wCtx, turn);

		const updated = CodingAgentTurn.withAgentSessionId(
			turn,
			"new-agent-session",
		);
		await turnRepo.upsert(wCtx, updated);

		const retrieved = await turnRepo.get(rCtx, CodingAgentTurn.ById(turn.id));
		expect(retrieved).not.toBeNull();
		expect(retrieved?.agentSessionId).toBe("new-agent-session");
		expect(retrieved?.prompt).toBe(turn.prompt);
	});

	test("updates agent message id via withAgentMessageId + upsert", async () => {
		const turn = createTestCodingAgentTurn({
			executionProcessId: EXECUTION_PROCESS_ID,
			agentMessageId: null,
		});
		await turnRepo.upsert(wCtx, turn);

		const updated = CodingAgentTurn.withAgentMessageId(turn, "new-msg-id");
		await turnRepo.upsert(wCtx, updated);

		const retrieved = await turnRepo.get(rCtx, CodingAgentTurn.ById(turn.id));
		expect(retrieved).not.toBeNull();
		expect(retrieved?.agentMessageId).toBe("new-msg-id");
		expect(retrieved?.prompt).toBe(turn.prompt);
	});

	test("updates summary via withSummary + upsert", async () => {
		const turn = createTestCodingAgentTurn({
			executionProcessId: EXECUTION_PROCESS_ID,
			summary: null,
		});
		await turnRepo.upsert(wCtx, turn);

		const updated = CodingAgentTurn.withSummary(
			turn,
			"Task completed successfully",
		);
		await turnRepo.upsert(wCtx, updated);

		const retrieved = await turnRepo.get(rCtx, CodingAgentTurn.ById(turn.id));
		expect(retrieved).not.toBeNull();
		expect(retrieved?.summary).toBe("Task completed successfully");
		expect(retrieved?.prompt).toBe(turn.prompt);
	});
});

describe("CodingAgentTurnRepository findLatestResumeInfo", () => {
	test("returns resume info for completed process", async () => {
		await markCodingAgentProcessCompleted();

		const turn = createTestCodingAgentTurn({
			executionProcessId: EXECUTION_PROCESS_ID,
			agentSessionId: "resume-session",
			agentMessageId: "resume-msg",
		});
		await turnRepo.upsert(wCtx, turn);

		const info = await turnRepo.findLatestResumeInfo(rCtx, SESSION_ID);
		expect(info).not.toBeNull();
		expect(info?.agentSessionId).toBe("resume-session");
		expect(info?.agentMessageId).toBe("resume-msg");
	});

	test("returns null for running process (cannot resume active session)", async () => {
		const turn = createTestCodingAgentTurn({
			executionProcessId: EXECUTION_PROCESS_ID,
			agentSessionId: "active-session",
			agentMessageId: "active-msg",
		});
		await turnRepo.upsert(wCtx, turn);

		// EP is still 'running' from seed, so should return null
		const info = await turnRepo.findLatestResumeInfo(rCtx, SESSION_ID);
		expect(info).toBeNull();
	});

	test("returns null when no turns have agent session id", async () => {
		const turn = createTestCodingAgentTurn({
			executionProcessId: EXECUTION_PROCESS_ID,
			agentSessionId: null,
		});
		await turnRepo.upsert(wCtx, turn);

		expect(await turnRepo.findLatestResumeInfo(rCtx, SESSION_ID)).toBeNull();
	});

	test("returns null for non-existent session", async () => {
		expect(
			await turnRepo.findLatestResumeInfo(rCtx, "non-existent"),
		).toBeNull();
	});
});

describe("CodingAgentTurnRepository findLatestResumeInfoByWorkspaceId", () => {
	test("returns resume info for completed process across workspace sessions", async () => {
		await markCodingAgentProcessCompleted();

		const turn = createTestCodingAgentTurn({
			executionProcessId: EXECUTION_PROCESS_ID,
			agentSessionId: "ws-resume-session",
			agentMessageId: "ws-resume-msg",
		});
		await turnRepo.upsert(wCtx, turn);

		const info = await turnRepo.findLatestResumeInfoByWorkspaceId(
			rCtx,
			WORKSPACE_ID,
		);
		expect(info).not.toBeNull();
		expect(info?.agentSessionId).toBe("ws-resume-session");
		expect(info?.agentMessageId).toBe("ws-resume-msg");
	});

	test("returns null for workspace with no agent sessions", async () => {
		expect(
			await turnRepo.findLatestResumeInfoByWorkspaceId(rCtx, WORKSPACE_ID),
		).toBeNull();
	});

	test("returns null for non-existent workspace", async () => {
		expect(
			await turnRepo.findLatestResumeInfoByWorkspaceId(rCtx, "non-existent"),
		).toBeNull();
	});
});
