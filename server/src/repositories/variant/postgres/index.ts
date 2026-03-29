import type { PgDatabase } from "../../../db/pg-client";
import type { Cursor, Page } from "../../../models/common";
import type { Variant } from "../../../models/variant";
import type { IVariantRepository } from "../repository";
import { del } from "./delete";
import { get } from "./get";
import { list } from "./list";
import { listByExecutor } from "./listByExecutor";
import { upsert } from "./upsert";

export class PgVariantRepository implements IVariantRepository {
	constructor(private db: PgDatabase) {}

	async get(spec: Variant.Spec): Promise<Variant | null> {
		return get(this.db, spec);
	}

	async list(
		spec: Variant.Spec,
		cursor: Cursor<Variant.SortKey>,
	): Promise<Page<Variant>> {
		return list(this.db, spec, cursor);
	}

	async listByExecutor(executor: string): Promise<Variant[]> {
		return listByExecutor(this.db, executor);
	}

	async upsert(variant: Variant): Promise<void> {
		await upsert(this.db, variant);
	}

	async delete(spec: Variant.Spec): Promise<number> {
		return del(this.db, spec);
	}
}
