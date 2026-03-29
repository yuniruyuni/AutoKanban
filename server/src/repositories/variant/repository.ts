import type { Cursor, Page } from "../../models/common";
import type { Variant } from "../../models/variant";

export interface IVariantRepository {
	get(spec: Variant.Spec): Variant | null;
	list(spec: Variant.Spec, cursor: Cursor<Variant.SortKey>): Page<Variant>;
	listByExecutor(executor: string): Variant[];
	upsert(variant: Variant): void;
	delete(spec: Variant.Spec): number;
}
