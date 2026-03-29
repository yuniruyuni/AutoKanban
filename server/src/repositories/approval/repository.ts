import type { Approval } from "../../models/approval";
import type { Cursor, Page } from "../../models/common";

export interface IApprovalRepository {
	get(spec: Approval.Spec): Promise<Approval | null>;
	list(
		spec: Approval.Spec,
		cursor: Cursor<Approval.SortKey>,
	): Promise<Page<Approval>>;
	upsert(approval: Approval): Promise<void>;
	delete(spec: Approval.Spec): Promise<number>;
}
