import type { Database, SQLQueryBindings } from "bun:sqlite";
import type { Cursor, Page } from "../models/common";
import { Variant } from "../models/variant";
import type { IVariantRepository } from "../types/repository";
import { compToSQL, dateFromSQL, dateToSQL } from "./common";
import { type SQLFragment, sql } from "./sql";

// ============================================
// Row type
// ============================================

interface VariantRow {
	id: string;
	executor: string;
	name: string;
	permission_mode: string;
	model: string | null;
	append_prompt: string | null;
	created_at: string;
	updated_at: string;
}

// ============================================
// Spec to SQL converter
// ============================================

type VariantSpecData =
	| { type: "ById"; id: string }
	| { type: "ByExecutor"; executor: string }
	| { type: "ByExecutorAndName"; executor: string; name: string };

function variantSpecToSQL(spec: VariantSpecData): SQLFragment {
	switch (spec.type) {
		case "ById":
			return sql`id = ${spec.id}`;
		case "ByExecutor":
			return sql`executor = ${spec.executor}`;
		case "ByExecutorAndName":
			return sql`executor = ${spec.executor} AND name = ${spec.name}`;
	}
}

// ============================================
// Row to Entity converter
// ============================================

function rowToVariant(row: VariantRow): Variant {
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

// ============================================
// Variant Repository
// ============================================

export class VariantRepository implements IVariantRepository {
	constructor(private db: Database) {}

	get(spec: Variant.Spec): Variant | null {
		const where = compToSQL(
			spec,
			variantSpecToSQL as (s: unknown) => SQLFragment,
		);
		const row = this.db
			.query<VariantRow, SQLQueryBindings[]>(
				`SELECT * FROM variants WHERE ${where.query} LIMIT 1`,
			)
			.get(...(where.params as SQLQueryBindings[]));

		return row ? rowToVariant(row) : null;
	}

	list(spec: Variant.Spec, cursor: Cursor<Variant.SortKey>): Page<Variant> {
		const where = compToSQL(
			spec,
			variantSpecToSQL as (s: unknown) => SQLFragment,
		);

		const sort = cursor.sort ?? Variant.defaultSort;
		const orderBy = sort.keys
			.map((k) => `${this.columnName(k)} ${sort.order.toUpperCase()}`)
			.join(", ");

		const limit = cursor.limit + 1;

		const rows = this.db
			.query<VariantRow, SQLQueryBindings[]>(
				`SELECT * FROM variants WHERE ${where.query} ORDER BY ${orderBy} LIMIT ${limit}`,
			)
			.all(...(where.params as SQLQueryBindings[]));

		const hasMore = rows.length > cursor.limit;
		const items = rows.slice(0, cursor.limit).map(rowToVariant);

		const lastItem = items[items.length - 1];
		const nextCursor =
			hasMore && lastItem ? Variant.cursor(lastItem, sort.keys) : undefined;

		return { items, hasMore, nextCursor };
	}

	listByExecutor(executor: string): Variant[] {
		const rows = this.db
			.query<VariantRow, [string]>(
				"SELECT * FROM variants WHERE executor = ? ORDER BY created_at ASC, id ASC",
			)
			.all(executor);

		return rows.map(rowToVariant);
	}

	upsert(variant: Variant): void {
		this.db
			.query(
				`INSERT INTO variants (id, executor, name, permission_mode, model, append_prompt, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           executor = excluded.executor,
           name = excluded.name,
           permission_mode = excluded.permission_mode,
           model = excluded.model,
           append_prompt = excluded.append_prompt,
           updated_at = excluded.updated_at`,
			)
			.run(
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

	delete(spec: Variant.Spec): number {
		const where = compToSQL(
			spec,
			variantSpecToSQL as (s: unknown) => SQLFragment,
		);
		const result = this.db
			.query<{ changes: number }, SQLQueryBindings[]>(
				`DELETE FROM variants WHERE ${where.query}`,
			)
			.run(...(where.params as SQLQueryBindings[]));

		return result.changes;
	}

	private columnName(key: Variant.SortKey): string {
		const map: Record<Variant.SortKey, string> = {
			createdAt: "created_at",
			id: "id",
		};
		return map[key];
	}
}
