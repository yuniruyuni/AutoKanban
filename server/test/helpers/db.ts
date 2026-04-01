import { join } from "node:path";
import type { Database } from "../../src/infra/db/database";
import { PgDatabase } from "../../src/infra/db/pg-client";
import { EmbeddedPostgresManager } from "../../src/infra/db/postgres";
import { schemaFiles } from "../../src/infra/db/schema-vfs";

let pgManager: EmbeddedPostgresManager | null = null;
let initPromise: Promise<PgDatabase> | null = null;

const DEFAULT_DATA_DIR = join(import.meta.dir, "../../.test-pg-data");

async function doInit(dataDir: string): Promise<PgDatabase> {
	pgManager = new EmbeddedPostgresManager({ dataDir });

	await pgManager.start();

	const db = new PgDatabase(pgManager.poolConfig);

	// Ensure schema exists
	const result = await db.queryGet<{ exists: boolean }>({
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
			await db.queryRun({ query: stmt, params: [] });
		}
	}

	return db;
}

function ensureReady(dataDir: string): Promise<PgDatabase> {
	if (!initPromise) {
		initPromise = doInit(dataDir);
	}
	return initPromise;
}

// Stop PostgreSQL when the process exits so bun doesn't hang
async function cleanup() {
	const db = await initPromise;
	if (db) {
		await db.close();
	}
	if (pgManager) {
		await pgManager.stop();
		pgManager = null;
	}
	initPromise = null;
}
process.on("beforeExit", cleanup);
process.on("SIGINT", cleanup);
process.on("SIGTERM", cleanup);

/**
 * Get a PgDatabase for tests. Starts embedded-postgres on first call.
 * Truncates all tables for isolation between tests.
 */
export async function createTestDB(options?: {
	dataDir?: string;
}): Promise<PgDatabase> {
	const db = await ensureReady(options?.dataDir ?? DEFAULT_DATA_DIR);

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
