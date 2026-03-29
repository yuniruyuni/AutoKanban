import type { Database } from "bun:sqlite";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { createTestSession } from "../../test/factories";
import { createTestDB } from "../../test/helpers/db";
import { expectEntityEqual } from "../../test/helpers/entity-equality";
import { seedFullChain } from "../../test/helpers/seed";
import { Session } from "../models/session";
import { SessionRepository } from "./session";

let db: Database;
let sessionRepo: SessionRepository;
let WORKSPACE_ID: string;

beforeEach(() => {
	db = createTestDB();
	sessionRepo = new SessionRepository(db);

	const seed = seedFullChain(db);
	WORKSPACE_ID = seed.workspace.id;
});

afterEach(() => {
	db.close();
});

// ============================================
// P1: Round-trip
// ============================================

describe("SessionRepository round-trip", () => {
	test("preserves all fields", () => {
		const session = createTestSession({
			workspaceId: WORKSPACE_ID,
			executor: "claude-code",
			variant: "opus",
		});
		sessionRepo.upsert(session);

		const retrieved = sessionRepo.get(Session.ById(session.id));
		expect(retrieved).not.toBeNull();
		expectEntityEqual(retrieved as Session, session, [
			"createdAt",
			"updatedAt",
		]);
	});

	test("preserves null executor and variant", () => {
		const session = createTestSession({
			workspaceId: WORKSPACE_ID,
			executor: null,
			variant: null,
		});
		sessionRepo.upsert(session);

		const retrieved = sessionRepo.get(Session.ById(session.id));
		expect(retrieved).not.toBeNull();
		expect(retrieved?.executor).toBeNull();
		expect(retrieved?.variant).toBeNull();
	});

	test("preserves string executor and variant", () => {
		const session = createTestSession({
			workspaceId: WORKSPACE_ID,
			executor: "custom-executor",
			variant: "custom-variant",
		});
		sessionRepo.upsert(session);

		const retrieved = sessionRepo.get(Session.ById(session.id));
		expect(retrieved).not.toBeNull();
		expect(retrieved?.executor).toBe("custom-executor");
		expect(retrieved?.variant).toBe("custom-variant");
	});
});

// ============================================
// P2: Update round-trip
// ============================================

describe("SessionRepository update round-trip", () => {
	test("reflects all changed fields", () => {
		const session = createTestSession({ workspaceId: WORKSPACE_ID });
		sessionRepo.upsert(session);

		const updated: Session = {
			...session,
			executor: "new-executor",
			variant: "new-variant",
			updatedAt: new Date(),
		};
		sessionRepo.upsert(updated);

		const retrieved = sessionRepo.get(Session.ById(session.id));
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
	test("get returns null for non-existent id", () => {
		expect(sessionRepo.get(Session.ById("non-existent"))).toBeNull();
	});

	test("list returns empty page", () => {
		const page = sessionRepo.list(Session.ByWorkspaceId("non-existent"), {
			limit: 10,
		});
		expect(page.items).toHaveLength(0);
		expect(page.hasMore).toBe(false);
	});
});

// ============================================
// P4: Multiple elements
// ============================================

describe("SessionRepository multiple elements", () => {
	test("stores and retrieves multiple sessions", () => {
		// seedFullChain already created 1 session for this workspace
		for (let i = 0; i < 3; i++) {
			sessionRepo.upsert(createTestSession({ workspaceId: WORKSPACE_ID }));
		}

		const page = sessionRepo.list(Session.ByWorkspaceId(WORKSPACE_ID), {
			limit: 50,
		});
		expect(page.items).toHaveLength(4); // 1 from seed + 3 new
	});
});

// ============================================
// P5: Delete
// ============================================

describe("SessionRepository delete", () => {
	test("deletes and confirms absence", () => {
		const session = createTestSession({ workspaceId: WORKSPACE_ID });
		sessionRepo.upsert(session);

		const deleted = sessionRepo.delete(Session.ById(session.id));
		expect(deleted).toBe(1);
		expect(sessionRepo.get(Session.ById(session.id))).toBeNull();
	});

	test("returns 0 when nothing to delete", () => {
		expect(sessionRepo.delete(Session.ById("non-existent"))).toBe(0);
	});
});

// ============================================
// P6: Spec filtering
// ============================================

describe("SessionRepository spec filtering", () => {
	test("ById finds correct session", () => {
		const session = createTestSession({ workspaceId: WORKSPACE_ID });
		sessionRepo.upsert(session);

		const retrieved = sessionRepo.get(Session.ById(session.id));
		expect(retrieved).not.toBeNull();
		expect(retrieved?.id).toBe(session.id);
	});

	test("ByWorkspaceId filters by workspace", () => {
		const session = createTestSession({ workspaceId: WORKSPACE_ID });
		sessionRepo.upsert(session);

		// seedFullChain already created 1 session for this workspace
		const page = sessionRepo.list(Session.ByWorkspaceId(WORKSPACE_ID), {
			limit: 50,
		});
		expect(page.items).toHaveLength(2); // 1 from seed + 1 new
		expect(page.items.every((s) => s.workspaceId === WORKSPACE_ID)).toBe(true);
	});
});
