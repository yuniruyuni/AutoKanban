import { PgDatabase } from "../../repositories/common";
import { ensurePgSchema } from "./pgschema";
import { EmbeddedPostgresManager } from "./postgres";
import { seedTaskTemplates } from "../../usecases/setup/seed-templates";

let db: PgDatabase | null = null;
let pgManager: EmbeddedPostgresManager | null = null;

export function getDatabase(): PgDatabase {
	if (!db) {
		throw new Error("Database not initialized. Call initDatabase() first.");
	}
	return db;
}

export async function initDatabase(): Promise<PgDatabase> {
	pgManager = new EmbeddedPostgresManager();
	await pgManager.start();

	await ensurePgSchema(pgManager.connectionParams);

	db = new PgDatabase(pgManager.poolConfig);

	await seedTaskTemplates(db);

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
