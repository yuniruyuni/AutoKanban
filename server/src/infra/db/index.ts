import type pg from "pg";
import type { ILogger } from "../logger/types";
import { PgDatabase } from "./pg-client";
import { ensurePgSchema } from "./pgschema";
import { EmbeddedPostgresManager } from "./postgres";

let db: PgDatabase | null = null;
let pgManager: EmbeddedPostgresManager | null = null;

export function getDatabase(): PgDatabase {
	if (!db) {
		throw new Error("Database not initialized. Call initDatabase() first.");
	}
	return db;
}

/**
 * One-time migration: drop legacy execution_processes tables and their FK
 * constraints before pgschema runs, so pgschema's CASCADE + explicit DROP
 * CONSTRAINT don't conflict within the same transaction.
 */
async function migrateFromExecutionProcesses(
	poolConfig: pg.PoolConfig,
	log: ReturnType<ILogger["child"]>,
): Promise<void> {
	const tmpDb = new PgDatabase(poolConfig);
	try {
		const exists = await tmpDb.queryGet<{ exists: boolean }>({
			query: `SELECT EXISTS (
				SELECT 1 FROM information_schema.tables
				WHERE table_schema = 'public' AND table_name = 'execution_processes'
			) AS exists`,
			params: [],
		});
		if (!exists?.exists) return;

		log.info("Migrating: dropping legacy execution_processes tables...");
		await tmpDb.queryRun({
			query: `
				ALTER TABLE IF EXISTS approvals
					DROP CONSTRAINT IF EXISTS approvals_execution_process_id_fkey;
				ALTER TABLE IF EXISTS coding_agent_turns
					DROP CONSTRAINT IF EXISTS coding_agent_turns_execution_process_id_fkey;
				DROP TABLE IF EXISTS execution_process_logs CASCADE;
				DROP TABLE IF EXISTS execution_processes CASCADE;
			`,
			params: [],
		});
		log.info("Legacy execution_processes tables dropped");
	} finally {
		await tmpDb.close();
	}
}

export async function initDatabase(logger: ILogger): Promise<PgDatabase> {
	const log = logger.child("Database");

	log.info("Starting embedded PostgreSQL...");
	pgManager = new EmbeddedPostgresManager();
	await pgManager.start();
	log.info(`PostgreSQL running on port ${pgManager.connectionParams.port}`);

	await migrateFromExecutionProcesses(pgManager.poolConfig, log);

	log.info("Applying schema with pgschema...");
	await ensurePgSchema(pgManager.connectionParams);
	log.info("Schema applied");

	log.info("Connecting to database...");
	db = new PgDatabase(pgManager.poolConfig);
	log.info("Database ready");

	return db;
}

export async function closeDatabase(): Promise<void> {
	if (db) {
		await db.close();
		db = null;
	}
	if (pgManager) {
		await pgManager.stop();
		pgManager = null;
	}
}
