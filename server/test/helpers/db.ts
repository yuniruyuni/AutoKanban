import { join } from "node:path";
import { type Database, PgDatabase } from "../../src/repositories/common";
import { EmbeddedPostgresManager } from "../../src/lib/db/postgres";
import { schemaFiles } from "../../src/lib/db/schema-vfs";

let pgManager: EmbeddedPostgresManager | null = null;
let sharedDb: PgDatabase | null = null;

const TEST_PORT = 5555;
const TEST_USER = "autokanban";
const TEST_PASSWORD = "autokanban";
const TEST_DATABASE = "autokanban";

async function ensureReady(): Promise<PgDatabase> {
	if (sharedDb) return sharedDb;

	pgManager = new EmbeddedPostgresManager({
		port: TEST_PORT,
		dataDir: join(import.meta.dir, "../../.test-pg-data"),
	});

	try {
		await pgManager.start();
	} catch {
		// PG may already be running from a previous test run — try connecting directly
	}

	sharedDb = new PgDatabase({
		host: "localhost",
		port: TEST_PORT,
		user: TEST_USER,
		password: TEST_PASSWORD,
		database: TEST_DATABASE,
	});

	// Ensure schema exists
	const result = await sharedDb.queryGet<{ exists: boolean }>({
		query: `SELECT EXISTS (
			SELECT FROM information_schema.tables
			WHERE table_schema = 'public' AND table_name = 'projects'
		)`,
		params: [],
	});

	if (!result?.exists) {
		const schema = schemaFiles["schema.sql"];
		const statements = schema
			.split(";")
			.map((s) => s.trim())
			.filter((s) => s.length > 0);
		for (const stmt of statements) {
			await sharedDb.queryRun({ query: stmt, params: [] });
		}
	}

	return sharedDb;
}

// Stop PostgreSQL when the process exits so bun doesn't hang
process.on("beforeExit", async () => {
	if (sharedDb) {
		await sharedDb.close();
		sharedDb = null;
	}
	if (pgManager) {
		await pgManager.stop();
		pgManager = null;
	}
});

/**
 * Get a PgDatabase for tests. Starts embedded-postgres on first call.
 * Truncates all tables for isolation between tests.
 */
export async function createTestDB(): Promise<PgDatabase> {
	const db = await ensureReady();

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
 * No-op for backwards compatibility.
 * The shared connection is kept alive across tests.
 */
export async function closeTestDB(_db: Database): Promise<void> {
	// Intentionally no-op: shared pool stays alive until process exit
}
