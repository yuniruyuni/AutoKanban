import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { schemaFiles } from "../../../schema";

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
		writeFileSync(join(dir, name), content);
	}
	return {
		path: dir,
		cleanup: () => rmSync(dir, { recursive: true, force: true }),
	};
}
