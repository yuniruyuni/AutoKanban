import path from "node:path";
import { Migrator } from "sqlite-auto-migrator";

export async function runMigrations(dbPath: string): Promise<void> {
	const schemaPath = path.join(import.meta.dir, "../../schema.sql");

	const migrator = new Migrator({
		schemaPath,
		dbPath,
		createDBIfMissing: true,
	});

	// In development, generate migration files if schema changed
	// Auto-accept all changes in development
	if (process.env.NODE_ENV === "development") {
		await migrator.make({
			onDestructiveChange: Migrator.PROCEED,
			onRename: Migrator.PROCEED,
			createOnManualMigration: true,
		});
	}

	// Apply pending migrations
	await migrator.migrate();
}
