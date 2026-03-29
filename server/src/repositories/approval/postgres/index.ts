import type { PgDatabase } from "../../../db/pg-client";
import type { Approval } from "../../../models/approval";
import type { Cursor, Page } from "../../../models/common";
import type { IApprovalRepository } from "../repository";
import { del } from "./delete";
import { get } from "./get";
import { list } from "./list";
import { upsert } from "./upsert";

export class ApprovalRepository implements IApprovalRepository {
	constructor(private db: PgDatabase) {}

	async get(spec: Approval.Spec): Promise<Approval | null> {
		return get(this.db, spec);
	}

	async list(
		spec: Approval.Spec,
		cursor: Cursor<Approval.SortKey>,
	): Promise<Page<Approval>> {
		return list(this.db, spec, cursor);
	}

	async upsert(approval: Approval): Promise<void> {
		await upsert(this.db, approval);
	}

	async delete(spec: Approval.Spec): Promise<number> {
		return del(this.db, spec);
	}
}
