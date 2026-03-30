/**
 * Bun plugin that intercepts import of schema-vfs.ts and injects
 * actual *.sql file contents from the schema/ directory into schemaFiles.
 *
 * Registered via bunfig.toml preload. The plugin scans schema/ recursively
 * at import time, so adding/removing .sql files takes effect on restart.
 */
import { plugin } from "bun";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const SCHEMA_DIR = join(import.meta.dir, "../schema");

function collectSqlFiles(dir: string, base: string): string[] {
	const entries = readdirSync(dir);
	const files: string[] = [];
	for (const entry of entries) {
		const fullPath = join(dir, entry);
		const stat = statSync(fullPath);
		if (stat.isDirectory()) {
			files.push(...collectSqlFiles(fullPath, base));
		} else if (entry.endsWith(".sql")) {
			files.push(relative(base, fullPath));
		}
	}
	return files.sort();
}

plugin({
	name: "schema-vfs",
	setup(build) {
		build.onLoad({ filter: /schema-vfs\.ts$/ }, () => {
			const sqlFiles = collectSqlFiles(SCHEMA_DIR, SCHEMA_DIR);
			const entries = sqlFiles
				.map((f) => {
					const content = readFileSync(join(SCHEMA_DIR, f), "utf-8");
					return `  ${JSON.stringify(f)}: ${JSON.stringify(content)}`;
				})
				.join(",\n");

			// Replace the placeholder schemaFiles with actual content,
			// keep extractSchema and other exports intact.
			return {
				contents: `
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";

export const schemaFiles: Record<string, string> = {
${entries}
};

export interface SchemaDir {
  path: string;
  cleanup(): void;
}

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
`,
				loader: "ts",
			};
		});
	},
});
