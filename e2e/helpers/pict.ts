import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Parse a PICT-generated TSV file into an array of typed objects.
 * Header row becomes the keys; each subsequent row becomes an object.
 */
export function parsePictTsv<T>(relativePath: string): T[] {
	const fullPath = join(import.meta.dir, "..", relativePath);
	const content = readFileSync(fullPath, "utf-8");
	const lines = content.trim().split("\n");
	if (lines.length < 2) return [];

	const headers = lines[0].split("\t");
	return lines.slice(1).map((line) => {
		const values = line.split("\t");
		const obj: Record<string, string> = {};
		for (let i = 0; i < headers.length; i++) {
			obj[headers[i]] = values[i] ?? "";
		}
		return obj as T;
	});
}
