import type { Database } from "bun:sqlite";
import type { Approval } from "../../../models/approval";
import type { Cursor, Page } from "../../../models/common";
import type { IApprovalRepository } from "../repository";
import { del } from "./delete";
import { get } from "./get";
import { list } from "./list";
import { upsert } from "./upsert";

export class ApprovalRepository implements IApprovalRepository {
	constructor(private db: Database) {}

	get(spec: Approval.Spec): Approval | null {
		return get(this.db, spec);
	}

	list(spec: Approval.Spec, cursor: Cursor<Approval.SortKey>): Page<Approval> {
		return list(this.db, spec, cursor);
	}

	upsert(approval: Approval): void {
		upsert(this.db, approval);
	}

	delete(spec: Approval.Spec): number {
		return del(this.db, spec);
	}
}
