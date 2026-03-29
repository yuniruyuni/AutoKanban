import type { Cursor, Page } from "../../models/common";
import type { Variant } from "../../models/variant";

export interface IVariantRepository {
	get(spec: Variant.Spec): Promise<Variant | null>;
	list(
		spec: Variant.Spec,
		cursor: Cursor<Variant.SortKey>,
	): Promise<Page<Variant>>;
	listByExecutor(executor: string): Promise<Variant[]>;
	upsert(variant: Variant): Promise<void>;
	delete(spec: Variant.Spec): Promise<number>;
}
