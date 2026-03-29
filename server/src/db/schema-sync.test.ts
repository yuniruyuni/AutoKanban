import { Database } from "bun:sqlite";
import { describe, expect, test } from "bun:test";
import { syncSchemaConstraints } from "./schema-sync";

describe("syncSchemaConstraints", () => {
	test("recreates table when CHECK constraint differs from schema.sql", () => {
		const db = new Database(":memory:");

		// Create execution_processes with MISSING 'awaiting_approval' in CHECK
		db.exec(`
			CREATE TABLE sessions (
				id TEXT PRIMARY KEY,
				workspace_id TEXT NOT NULL,
				created_at TEXT NOT NULL DEFAULT (datetime('now')),
				updated_at TEXT NOT NULL DEFAULT (datetime('now'))
			)
		`);
		db.exec(`
			CREATE TABLE execution_processes (
				id TEXT PRIMARY KEY,
				session_id TEXT NOT NULL REFERENCES sessions(id),
				run_reason TEXT NOT NULL DEFAULT 'setupscript'
					CHECK(run_reason IN ('setupscript', 'codingagent', 'devserver', 'cleanupscript')),
				status TEXT NOT NULL DEFAULT 'running'
					CHECK(status IN ('running', 'completed', 'failed', 'killed')),
				exit_code INTEGER,
				started_at TEXT NOT NULL DEFAULT (datetime('now')),
				completed_at TEXT,
				created_at TEXT NOT NULL DEFAULT (datetime('now')),
				updated_at TEXT NOT NULL DEFAULT (datetime('now'))
			)
		`);

		// Insert test data
		db.exec(`
			INSERT INTO sessions (id, workspace_id) VALUES ('s1', 'w1')
		`);
		db.exec(`
			INSERT INTO execution_processes (id, session_id, status)
			VALUES ('ep1', 's1', 'running')
		`);

		// Verify 'awaiting_approval' fails before sync
		expect(() => {
			db.exec(
				"UPDATE execution_processes SET status = 'awaiting_approval' WHERE id = 'ep1'",
			);
		}).toThrow();

		// Reset status
		db.exec(
			"UPDATE execution_processes SET status = 'running' WHERE id = 'ep1'",
		);

		// Run sync
		const fixedCount = syncSchemaConstraints(db);
		expect(fixedCount).toBeGreaterThan(0);

		// Verify 'awaiting_approval' now works
		db.exec(
			"UPDATE execution_processes SET status = 'awaiting_approval' WHERE id = 'ep1'",
		);
		const row = db
			.query<{ status: string }, []>(
				"SELECT status FROM execution_processes WHERE id = 'ep1'",
			)
			.get();
		expect(row?.status).toBe("awaiting_approval");
	});

	test("preserves data during table recreation", () => {
		const db = new Database(":memory:");

		db.exec(`
			CREATE TABLE sessions (
				id TEXT PRIMARY KEY,
				workspace_id TEXT NOT NULL,
				created_at TEXT NOT NULL DEFAULT (datetime('now')),
				updated_at TEXT NOT NULL DEFAULT (datetime('now'))
			)
		`);
		db.exec(`
			CREATE TABLE execution_processes (
				id TEXT PRIMARY KEY,
				session_id TEXT NOT NULL REFERENCES sessions(id),
				run_reason TEXT NOT NULL DEFAULT 'setupscript'
					CHECK(run_reason IN ('setupscript', 'codingagent', 'devserver', 'cleanupscript')),
				status TEXT NOT NULL DEFAULT 'running'
					CHECK(status IN ('running', 'completed', 'failed', 'killed')),
				exit_code INTEGER,
				started_at TEXT NOT NULL DEFAULT (datetime('now')),
				completed_at TEXT,
				created_at TEXT NOT NULL DEFAULT (datetime('now')),
				updated_at TEXT NOT NULL DEFAULT (datetime('now'))
			)
		`);

		db.exec(
			"INSERT INTO sessions (id, workspace_id) VALUES ('s1', 'w1')",
		);
		db.exec(
			"INSERT INTO execution_processes (id, session_id, status, exit_code) VALUES ('ep1', 's1', 'completed', 0)",
		);
		db.exec(
			"INSERT INTO execution_processes (id, session_id, status, exit_code) VALUES ('ep2', 's1', 'failed', 1)",
		);

		syncSchemaConstraints(db);

		// Verify data preserved
		const rows = db
			.query<
				{ id: string; status: string; exit_code: number | null },
				[]
			>("SELECT id, status, exit_code FROM execution_processes ORDER BY id")
			.all();
		expect(rows).toHaveLength(2);
		expect(rows[0]).toEqual({
			id: "ep1",
			status: "completed",
			exit_code: 0,
		});
		expect(rows[1]).toEqual({
			id: "ep2",
			status: "failed",
			exit_code: 1,
		});
	});

	test("skips tables that already match schema.sql", () => {
		const db = new Database(":memory:");

		// Create tables matching schema.sql exactly
		db.exec(`
			CREATE TABLE projects (
				id TEXT PRIMARY KEY,
				name TEXT NOT NULL,
				description TEXT,
				repo_path TEXT NOT NULL UNIQUE,
				branch TEXT NOT NULL DEFAULT 'main',
				setup_script TEXT,
				cleanup_script TEXT,
				dev_server_script TEXT,
				created_at TEXT NOT NULL DEFAULT (datetime('now')),
				updated_at TEXT NOT NULL DEFAULT (datetime('now'))
			)
		`);

		const fixedCount = syncSchemaConstraints(db);
		expect(fixedCount).toBe(0);
	});
});
