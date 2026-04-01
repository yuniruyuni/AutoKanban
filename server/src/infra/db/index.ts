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

export async function initDatabase(logger: ILogger): Promise<PgDatabase> {
	const log = logger.child("Database");

	log.info("Starting embedded PostgreSQL...");
	pgManager = new EmbeddedPostgresManager();
	await pgManager.start();
	log.info(`PostgreSQL running on port ${pgManager.connectionParams.port}`);

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
