import type { Database } from "../../common";
import type { Variant } from "../../../models/variant";
import { rowToVariant, type VariantRow } from "./common";

export async function listByExecutor(
	db: Database,
	executor: string,
): Promise<Variant[]> {
	const rows = await db.queryAll<VariantRow>({
		query:
			"SELECT * FROM variants WHERE executor = ? ORDER BY created_at ASC, id ASC",
		params: [executor],
	});

	return rows.map(rowToVariant);
}
