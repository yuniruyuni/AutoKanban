import type { Database } from "bun:sqlite";
import type { Variant } from "../../../models/variant";
import { dateToSQL } from "../../common";

export function upsert(db: Database, variant: Variant): void {
	db.query(
		`INSERT INTO variants (id, executor, name, permission_mode, model, append_prompt, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       executor = excluded.executor,
       name = excluded.name,
       permission_mode = excluded.permission_mode,
       model = excluded.model,
       append_prompt = excluded.append_prompt,
       updated_at = excluded.updated_at`,
	).run(
		variant.id,
		variant.executor,
		variant.name,
		variant.permissionMode,
		variant.model,
		variant.appendPrompt,
		dateToSQL(variant.createdAt),
		dateToSQL(variant.updatedAt),
	);
}
