import type { Approval } from "../../../models/approval";
import type { ServiceCtx } from "../../common";
import type { ApprovalStoreRepository } from "../repository";

export interface ApprovalResponse {
	status: Approval.Status;
	reason: string | null;
}

interface PendingApproval {
	approval: Approval;
	resolve: (response: ApprovalResponse) => void;
}

export class ApprovalStore implements ApprovalStoreRepository {
	private pending = new Map<string, PendingApproval>();

	async createAndWait(
		_ctx: ServiceCtx,
		approval: Approval,
	): Promise<ApprovalResponse> {
		return new Promise<ApprovalResponse>((resolve) => {
			this.pending.set(approval.id, { approval, resolve });
		});
	}

	async respond(
		_ctx: ServiceCtx,
		id: string,
		status: "approved" | "denied",
		reason: string | null,
	): Promise<boolean> {
		const pending = this.pending.get(id);
		if (!pending) return false;

		pending.resolve({ status, reason });
		this.pending.delete(id);
		return true;
	}

	hasPending(_ctx: ServiceCtx, executionProcessId: string): boolean {
		for (const [, pending] of this.pending) {
			if (pending.approval.executionProcessId === executionProcessId) {
				return true;
			}
		}
		return false;
	}

	listPending(_ctx: ServiceCtx, executionProcessId: string): Approval[] {
		const result: Approval[] = [];
		for (const [, pending] of this.pending) {
			if (pending.approval.executionProcessId === executionProcessId) {
				result.push(pending.approval);
			}
		}
		return result;
	}

	clear(_ctx: ServiceCtx): void {
		this.pending.clear();
	}
}

export const approvalStore = new ApprovalStore();
