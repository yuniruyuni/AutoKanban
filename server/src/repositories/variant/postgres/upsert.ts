import type { PgDatabase } from "../../../db/pg-client";
import type { Variant } from "../../../models/variant";
import { dateToSQL } from "../../common";

export async function upsert(
	db: PgDatabase,
	variant: Variant,
): Promise<void> {
	await db.queryRun({
		query: `INSERT INTO variants (id, executor, name, permission_mode, model, append_prompt, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       executor = excluded.executor,
       name = excluded.name,
       permission_mode = excluded.permission_mode,
       model = excluded.model,
       append_prompt = excluded.append_prompt,
       updated_at = excluded.updated_at`,
		params: [
			variant.id,
			variant.executor,
			variant.name,
			variant.permissionMode,
			variant.model,
			variant.appendPrompt,
			dateToSQL(variant.createdAt),
			dateToSQL(variant.updatedAt),
		],
	});
}
