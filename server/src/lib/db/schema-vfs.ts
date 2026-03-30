/**
 * Schema VFS — provides schema files embedded from the schema/ directory.
 *
 * At runtime, the build/schema-vfs.ts Bun plugin intercepts this module's
 * import and replaces schemaFiles with actual file contents from schema/.
 * This allows bun build --compile to embed all schema files in the binary.
 *
 * The exported schemaFiles below is a fallback (never used when plugin is active).
 */
export const schemaFiles: Record<string, string> = {};

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";

export interface SchemaDir {
	/** Absolute path to the temp directory containing schema files */
	path: string;
	/** Remove the temp directory and all contents */
	cleanup(): void;
}

/**
 * Extract embedded schema files to a secure temporary directory.
 * The caller must call cleanup() when done.
 */
export function extractSchema(): SchemaDir {
	const dir = mkdtempSync(join(tmpdir(), "autokanban-schema-"));
	for (const [name, content] of Object.entries(schemaFiles)) {
		const filePath = join(dir, name);
		mkdirSync(dirname(filePath), { recursive: true });
		writeFileSync(filePath, content);
	}
	return {
		path: dir,
		cleanup: () => rmSync(dir, { recursive: true, force: true }),
	};
}
