import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { runMigrations } from "./migrate";
import { seedTaskTemplates } from "./seed-templates";

let db: Database | null = null;

export function getDatabase(): Database {
	if (!db) {
		throw new Error("Database not initialized. Call initDatabase() first.");
	}
	return db;
}

export async function initDatabase(dbPath: string): Promise<Database> {
	// Ensure the directory exists
	mkdirSync(dirname(dbPath), { recursive: true });

	// Run migrations first
	await runMigrations(dbPath);

	// Then open the database
	db = new Database(dbPath);
	db.exec("PRAGMA foreign_keys = ON");

	seedTaskTemplates(db);

	return db;
}

export function closeDatabase(): void {
	if (db) {
		db.close();
		db = null;
	}
}
