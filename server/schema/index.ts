/**
 * Schema VFS manifest.
 *
 * All SQL files in this directory are imported as text and exported
 * as a Record<path, content>. This allows bun build --compile to
 * embed them in the single binary.
 *
 * When adding modular schema files (pgschema modular schema support),
 * add new imports here.
 */
import schema from "./schema.sql";

export const schemaFiles: Record<string, string> = {
	"schema.sql": schema,
};
