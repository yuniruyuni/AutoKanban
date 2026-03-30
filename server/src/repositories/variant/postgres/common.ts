import { type SQLFragment, sql } from "../../../lib/db/sql";
import { dateFromSQL } from "../../../lib/db/sql-helpers";
import type { Variant } from "../../../models/variant";

export interface VariantRow {
	id: string;
	executor: string;
	name: string;
	permission_mode: string;
	model: string | null;
	append_prompt: string | null;
	created_at: Date;
	updated_at: Date;
}

type VariantSpecData =
	| { type: "ById"; id: string }
	| { type: "ByExecutor"; executor: string }
	| { type: "ByExecutorAndName"; executor: string; name: string };

export function variantSpecToSQL(spec: VariantSpecData): SQLFragment {
	switch (spec.type) {
		case "ById":
			return sql`id = ${spec.id}`;
		case "ByExecutor":
			return sql`executor = ${spec.executor}`;
		case "ByExecutorAndName":
			return sql`executor = ${spec.executor} AND name = ${spec.name}`;
	}
}

export function rowToVariant(row: VariantRow): Variant {
	return {
		id: row.id,
		executor: row.executor,
		name: row.name,
		permissionMode: row.permission_mode,
		model: row.model,
		appendPrompt: row.append_prompt,
		createdAt: dateFromSQL(row.created_at),
		updatedAt: dateFromSQL(row.updated_at),
	};
}

export function columnName(key: Variant.SortKey): string {
	const map: Record<Variant.SortKey, string> = {
		createdAt: "created_at",
		id: "id",
	};
	return map[key];
}
