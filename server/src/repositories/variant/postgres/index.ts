import type { Cursor, Page } from "../../../models/common";
import type { Variant } from "../../../models/variant";
import type { DbReadCtx, DbWriteCtx } from "../../../types/db-capability";
import type { VariantRepository as IVariantRepository } from "../repository";
import { del } from "./delete";
import { get } from "./get";
import { list } from "./list";
import { listByExecutor } from "./listByExecutor";
import { upsert } from "./upsert";

export class VariantRepository implements IVariantRepository {
	async get(ctx: DbReadCtx, spec: Variant.Spec): Promise<Variant | null> {
		return get(ctx.db, spec);
	}

	async list(
		ctx: DbReadCtx,
		spec: Variant.Spec,
		cursor: Cursor<Variant.SortKey>,
	): Promise<Page<Variant>> {
		return list(ctx.db, spec, cursor);
	}

	async listByExecutor(ctx: DbReadCtx, executor: string): Promise<Variant[]> {
		return listByExecutor(ctx.db, executor);
	}

	async upsert(ctx: DbWriteCtx, variant: Variant): Promise<void> {
		await upsert(ctx.db, variant);
	}

	async delete(ctx: DbWriteCtx, spec: Variant.Spec): Promise<number> {
		return del(ctx.db, spec);
	}
}
