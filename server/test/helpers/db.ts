import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PgDatabase } from "../../src/db/pg-client";
import { EmbeddedPostgresManager } from "../../src/db/postgres";

let pgManager: EmbeddedPostgresManager | null = null;
let pgStarted = false;

const TEST_PORT = 5555;

async function ensurePgStarted(): Promise<EmbeddedPostgresManager> {
	if (pgManager && pgStarted) return pgManager;

	pgManager = new EmbeddedPostgresManager({
		port: TEST_PORT,
		dataDir: join(import.meta.dir, "../../.test-pg-data"),
	});
	await pgManager.start();
	pgStarted = true;
	return pgManager;
}

/**
 * Create a PgDatabase connected to a test PostgreSQL instance.
 * Schema is applied by truncating all tables for isolation.
 */
export async function createTestDB(): Promise<PgDatabase> {
	const manager = await ensurePgStarted();
	const db = new PgDatabase(manager.poolConfig);

	// Apply schema if tables don't exist yet
	const result = await db.queryGet<{ exists: boolean }>({
		query: `SELECT EXISTS (
			SELECT FROM information_schema.tables
			WHERE table_schema = 'public' AND table_name = 'projects'
		)`,
		params: [],
	});

	if (!result?.exists) {
		const schemaPath = join(import.meta.dir, "../../schema.sql");
		const schema = readFileSync(schemaPath, "utf-8");
		// Execute each statement separately
		const statements = schema
			.split(";")
			.map((s) => s.trim())
			.filter((s) => s.length > 0);
		for (const stmt of statements) {
			await db.queryRun({ query: stmt, params: [] });
		}
	}

	// Truncate all tables for test isolation (respecting FK order)
	await db.queryRun({
		query: `
		TRUNCATE TABLE
			approvals,
			coding_agent_turns,
			execution_process_logs,
			execution_processes,
			workspace_repos,
			sessions,
			workspaces,
			tasks,
			projects,
			variants,
			tools,
			project_task_templates
		CASCADE`,
		params: [],
	});

	return db;
}

/**
 * Close a test database connection.
 */
export async function closeTestDB(db: PgDatabase): Promise<void> {
	await db.close();
}
