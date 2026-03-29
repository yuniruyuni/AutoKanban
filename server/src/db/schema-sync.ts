import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Database } from "bun:sqlite";

/**
 * Ensures the live DB schema matches schema.sql.
 *
 * sqlite-auto-migrator handles column additions/renames but cannot modify
 * CHECK constraints (SQLite limitation: ALTER TABLE can't change them).
 * This function detects tables whose CREATE TABLE statements differ from
 * schema.sql and recreates them with the correct schema, preserving data.
 *
 * Call this after runMigrations() and before the server starts.
 */
export function syncSchemaConstraints(db: Database): number {
	const schemaPath = join(import.meta.dir, "../../schema.sql");
	const schemaSql = readFileSync(schemaPath, "utf-8");

	// Parse CREATE TABLE statements from schema.sql
	const expectedTables = parseCreateStatements(schemaSql);

	let fixedCount = 0;

	for (const [tableName, expectedSql] of expectedTables) {
		const liveRow = db
			.query<
				{ sql: string },
				[string]
			>("SELECT sql FROM sqlite_master WHERE type='table' AND name=?")
			.get(tableName);
		if (!liveRow) continue; // table doesn't exist yet — migrator will create it

		if (normalizeSql(liveRow.sql) === normalizeSql(expectedSql)) continue;

		// Schema mismatch — recreate table
		recreateTable(db, tableName, expectedSql);
		fixedCount++;
	}

	return fixedCount;
}

/**
 * Parse CREATE TABLE statements from a schema SQL file.
 * Returns Map of tableName → full CREATE TABLE statement.
 */
function parseCreateStatements(sql: string): Map<string, string> {
	const tables = new Map<string, string>();
	// Match CREATE TABLE ... ); spanning multiple lines
	const regex =
		/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(\w+)\s*\([\s\S]*?\);/gi;
	for (const match of sql.matchAll(regex)) {
		const name = match[1];
		tables.set(name, match[0]);
	}
	return tables;
}

/**
 * Normalize SQL for comparison: collapse whitespace, lowercase, remove IF NOT EXISTS.
 */
function normalizeSql(sql: string): string {
	return sql
		.replace(/IF\s+NOT\s+EXISTS\s+/gi, "")
		.replace(/\s+/g, " ")
		.replace(/\(\s+/g, "(")
		.replace(/\s+\)/g, ")")
		.replace(/,\s+/g, ", ")
		.replace(/["'`]/g, "")
		.replace(/;$/, "")
		.trim()
		.toLowerCase();
}

/**
 * Recreate a table with new schema, preserving existing data.
 * Uses the standard SQLite pattern: create new → copy → drop old → rename.
 */
function recreateTable(
	db: Database,
	tableName: string,
	createSql: string,
): void {
	const tmpName = `${tableName}__schema_sync_tmp`;

	// Get columns that exist in both old and new tables
	const oldColumns = getColumnNames(db, tableName);
	const newCreateSql = createSql
		.replace(
			new RegExp(
				`CREATE\\s+TABLE\\s+(?:IF\\s+NOT\\s+EXISTS\\s+)?${tableName}`,
				"i",
			),
			`CREATE TABLE ${tmpName}`,
		);

	db.exec("BEGIN TRANSACTION");
	try {
		// Create temp table with new schema
		db.exec(newCreateSql);

		// Get columns in new table
		const newColumns = getColumnNames(db, tmpName);

		// Find common columns (only copy columns that exist in both)
		const commonColumns = oldColumns.filter((c) => newColumns.includes(c));
		const columnList = commonColumns.join(", ");

		// Copy data
		db.exec(
			`INSERT INTO ${tmpName} (${columnList}) SELECT ${columnList} FROM ${tableName}`,
		);

		// Drop old, rename new
		db.exec(`DROP TABLE ${tableName}`);
		db.exec(`ALTER TABLE ${tmpName} RENAME TO ${tableName}`);

		db.exec("COMMIT");
	} catch (e) {
		db.exec("ROLLBACK");
		// Clean up temp table if it exists
		try {
			db.exec(`DROP TABLE IF EXISTS ${tmpName}`);
		} catch {
			// ignore
		}
		throw e;
	}
}

function getColumnNames(db: Database, tableName: string): string[] {
	const rows = db
		.query<{ name: string }, []>(`PRAGMA table_info(${tableName})`)
		.all();
	return rows.map((r) => r.name);
}
