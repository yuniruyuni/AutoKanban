import { beforeEach, describe, expect, test } from "bun:test";
import { createTestSession } from "../../../../test/factories";
import { createTestDB } from "../../../../test/helpers/db";
import { expectEntityEqual } from "../../../../test/helpers/entity-equality";
import { seedFullChain } from "../../../../test/helpers/seed";
import type { PgDatabase } from "../../../db/pg-client";
import { Session } from "../../../models/session";
import type { DbReadCtx, DbWriteCtx } from "../../common";
import { createDbReadCtx, createDbWriteCtx } from "../../common";
import { SessionRepository } from ".";

let db: PgDatabase;
let sessionRepo: SessionRepository;
let rCtx: DbReadCtx;
let wCtx: DbWriteCtx;
let WORKSPACE_ID: string;

beforeEach(async () => {
	db = await createTestDB();
	sessionRepo = new SessionRepository();
	rCtx = createDbReadCtx(db);
	wCtx = createDbWriteCtx(db);

	const seed = await seedFullChain(db);
	WORKSPACE_ID = seed.workspace.id;
});

// ============================================
// P1: Round-trip
// ============================================

describe("SessionRepository round-trip", () => {
	test("preserves all fields", async () => {
		const session = createTestSession({
			workspaceId: WORKSPACE_ID,
			executor: "claude-code",
			variant: "opus",
		});
		await sessionRepo.upsert(wCtx, session);

		const retrieved = await sessionRepo.get(rCtx, Session.ById(session.id));
		expect(retrieved).not.toBeNull();
		expectEntityEqual(retrieved as Session, session, [
			"createdAt",
			"updatedAt",
		]);
	});

	test("preserves null executor and variant", async () => {
		const session = createTestSession({
			workspaceId: WORKSPACE_ID,
			executor: null,
			variant: null,
		});
		await sessionRepo.upsert(wCtx, session);

		const retrieved = await sessionRepo.get(rCtx, Session.ById(session.id));
		expect(retrieved).not.toBeNull();
		expect(retrieved?.executor).toBeNull();
		expect(retrieved?.variant).toBeNull();
	});

	test("preserves string executor and variant", async () => {
		const session = createTestSession({
			workspaceId: WORKSPACE_ID,
			executor: "custom-executor",
			variant: "custom-variant",
		});
		await sessionRepo.upsert(wCtx, session);

		const retrieved = await sessionRepo.get(rCtx, Session.ById(session.id));
		expect(retrieved).not.toBeNull();
		expect(retrieved?.executor).toBe("custom-executor");
		expect(retrieved?.variant).toBe("custom-variant");
	});
});

// ============================================
// P2: Update round-trip
// ============================================

describe("SessionRepository update round-trip", () => {
	test("reflects all changed fields", async () => {
		const session = createTestSession({ workspaceId: WORKSPACE_ID });
		await sessionRepo.upsert(wCtx, session);

		const updated: Session = {
			...session,
			executor: "new-executor",
			variant: "new-variant",
			updatedAt: new Date(),
		};
		await sessionRepo.upsert(wCtx, updated);

		const retrieved = await sessionRepo.get(rCtx, Session.ById(session.id));
		expect(retrieved).not.toBeNull();
		expectEntityEqual(retrieved as Session, updated, [
			"createdAt",
			"updatedAt",
		]);
	});
});

// ============================================
// P3: Empty collection
// ============================================

describe("SessionRepository empty collection", () => {
	test("get returns null for non-existent id", async () => {
		expect(
			await sessionRepo.get(rCtx, Session.ById("non-existent")),
		).toBeNull();
	});

	test("list returns empty page", async () => {
		const page = await sessionRepo.list(
			rCtx,
			Session.ByWorkspaceId("non-existent"),
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

describe("SessionRepository multiple elements", () => {
	test("stores and retrieves multiple sessions", async () => {
		// seedFullChain already created 1 session for this workspace
		for (let i = 0; i < 3; i++) {
			await sessionRepo.upsert(
				wCtx,
				createTestSession({ workspaceId: WORKSPACE_ID }),
			);
		}

		const page = await sessionRepo.list(
			rCtx,
			Session.ByWorkspaceId(WORKSPACE_ID),
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

describe("SessionRepository delete", () => {
	test("deletes and confirms absence", async () => {
		const session = createTestSession({ workspaceId: WORKSPACE_ID });
		await sessionRepo.upsert(wCtx, session);

		const deleted = await sessionRepo.delete(wCtx, Session.ById(session.id));
		expect(deleted).toBe(1);
		expect(await sessionRepo.get(rCtx, Session.ById(session.id))).toBeNull();
	});

	test("returns 0 when nothing to delete", async () => {
		expect(await sessionRepo.delete(wCtx, Session.ById("non-existent"))).toBe(
			0,
		);
	});
});

// ============================================
// P6: Spec filtering
// ============================================

describe("SessionRepository spec filtering", () => {
	test("ById finds correct session", async () => {
		const session = createTestSession({ workspaceId: WORKSPACE_ID });
		await sessionRepo.upsert(wCtx, session);

		const retrieved = await sessionRepo.get(rCtx, Session.ById(session.id));
		expect(retrieved).not.toBeNull();
		expect(retrieved?.id).toBe(session.id);
	});

	test("ByWorkspaceId filters by workspace", async () => {
		const session = createTestSession({ workspaceId: WORKSPACE_ID });
		await sessionRepo.upsert(wCtx, session);

		// seedFullChain already created 1 session for this workspace
		const page = await sessionRepo.list(
			rCtx,
			Session.ByWorkspaceId(WORKSPACE_ID),
			{
				limit: 50,
			},
		);
		expect(page.items).toHaveLength(2); // 1 from seed + 1 new
		expect(page.items.every((s) => s.workspaceId === WORKSPACE_ID)).toBe(true);
	});
});
