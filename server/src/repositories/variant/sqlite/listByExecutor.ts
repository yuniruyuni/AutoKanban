import type { Database } from "bun:sqlite";
import type { Variant } from "../../../models/variant";
import { type VariantRow, rowToVariant } from "./common";

export function listByExecutor(db: Database, executor: string): Variant[] {
	const rows = db
		.query<VariantRow, [string]>(
			"SELECT * FROM variants WHERE executor = ? ORDER BY created_at ASC, id ASC",
		)
		.all(executor);

	return rows.map(rowToVariant);
}
