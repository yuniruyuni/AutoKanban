import type { Cursor, Page } from "../../models/common";
import type { Variant } from "../../models/variant";
import type { DbReadCtx, DbWriteCtx } from "../../types/db-capability";

export interface VariantRepository {
	get(ctx: DbReadCtx, spec: Variant.Spec): Promise<Variant | null>;
	list(
		ctx: DbReadCtx,
		spec: Variant.Spec,
		cursor: Cursor<Variant.SortKey>,
	): Promise<Page<Variant>>;
	listByExecutor(ctx: DbReadCtx, executor: string): Promise<Variant[]>;
	upsert(ctx: DbWriteCtx, variant: Variant): Promise<void>;
	delete(ctx: DbWriteCtx, spec: Variant.Spec): Promise<number>;
}
