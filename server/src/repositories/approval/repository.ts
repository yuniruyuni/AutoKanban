import type { Approval } from "../../models/approval";
import type { Cursor, Page } from "../../models/common";
import type { DbReadCtx, DbWriteCtx } from "../../types/db-capability";

export interface ApprovalRepository {
	get(ctx: DbReadCtx, spec: Approval.Spec): Promise<Approval | null>;
	list(
		ctx: DbReadCtx,
		spec: Approval.Spec,
		cursor: Cursor<Approval.SortKey>,
	): Promise<Page<Approval>>;
	upsert(ctx: DbWriteCtx, approval: Approval): Promise<void>;
	delete(ctx: DbWriteCtx, spec: Approval.Spec): Promise<number>;
}
