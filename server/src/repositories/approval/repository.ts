import type { Approval } from "../../models/approval";
import type { Cursor, Page } from "../../models/common";

export interface IApprovalRepository {
	get(spec: Approval.Spec): Approval | null;
	list(spec: Approval.Spec, cursor: Cursor<Approval.SortKey>): Page<Approval>;
	upsert(approval: Approval): void;
	delete(spec: Approval.Spec): number;
}
