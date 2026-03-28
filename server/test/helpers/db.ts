import { Database } from "bun:sqlite";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Create an in-memory SQLite database initialized with the project schema.
 * Use in beforeEach/afterEach for test isolation.
 */
export function createTestDB(): Database {
	const db = new Database(":memory:");
	const schemaPath = join(import.meta.dir, "../../schema.sql");
	const schema = readFileSync(schemaPath, "utf-8");
	db.exec(schema);
	return db;
}
