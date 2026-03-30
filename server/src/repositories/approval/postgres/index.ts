import type { Approval } from "../../../models/approval";
import type { Cursor, Page } from "../../../models/common";
import type { DbReadCtx, DbWriteCtx } from "../../../types/db-capability";
import type { IApprovalRepositoryDef } from "../repository";
import { del } from "./delete";
import { get } from "./get";
import { list } from "./list";
import { upsert } from "./upsert";

export class ApprovalRepository implements IApprovalRepositoryDef {
	async get(ctx: DbReadCtx, spec: Approval.Spec): Promise<Approval | null> {
		return get(ctx.db, spec);
	}

	async list(
		ctx: DbReadCtx,
		spec: Approval.Spec,
		cursor: Cursor<Approval.SortKey>,
	): Promise<Page<Approval>> {
		return list(ctx.db, spec, cursor);
	}

	async upsert(ctx: DbWriteCtx, approval: Approval): Promise<void> {
		await upsert(ctx.db, approval);
	}

	async delete(ctx: DbWriteCtx, spec: Approval.Spec): Promise<number> {
		return del(ctx.db, spec);
	}
}
