import type { Database } from "bun:sqlite";
import type { Cursor, Page } from "../../../models/common";
import type { Variant } from "../../../models/variant";
import type { IVariantRepository } from "../repository";
import { del } from "./delete";
import { get } from "./get";
import { list } from "./list";
import { listByExecutor } from "./listByExecutor";
import { upsert } from "./upsert";

export class VariantRepository implements IVariantRepository {
	constructor(private db: Database) {}

	get(spec: Variant.Spec): Variant | null {
		return get(this.db, spec);
	}

	list(spec: Variant.Spec, cursor: Cursor<Variant.SortKey>): Page<Variant> {
		return list(this.db, spec, cursor);
	}

	listByExecutor(executor: string): Variant[] {
		return listByExecutor(this.db, executor);
	}

	upsert(variant: Variant): void {
		upsert(this.db, variant);
	}

	delete(spec: Variant.Spec): number {
		return del(this.db, spec);
	}
}
