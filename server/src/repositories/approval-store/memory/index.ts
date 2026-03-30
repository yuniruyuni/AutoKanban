import { Approval } from "../../../models/approval";
import type { Full, ServiceCtx } from "../../../types/db-capability";
import type { ApprovalRepository } from "../../../types/repository";
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
		repo: Full<ApprovalRepository>,
	): Promise<ApprovalResponse> {
		await repo.upsert(approval);

		const existing = await repo.get(Approval.ById(approval.id));
		if (existing && existing.status !== "pending") {
			return { status: existing.status, reason: existing.reason };
		}

		return new Promise<ApprovalResponse>((resolve) => {
			this.pending.set(approval.id, { approval, resolve });
		});
	}

	async respond(
		_ctx: ServiceCtx,
		id: string,
		status: "approved" | "denied",
		reason: string | null,
		repo: Full<ApprovalRepository>,
	): Promise<boolean> {
		const existing = await repo.get(Approval.ById(id));
		if (!existing) return false;

		const updated = Approval.respond(existing, status, reason);
		await repo.upsert(updated);

		const pending = this.pending.get(id);
		if (pending) {
			pending.resolve({ status, reason });
			this.pending.delete(id);
			return true;
		}

		return true;
	}

	async getRespondedStatus(
		_ctx: ServiceCtx,
		approvalId: string,
		repo: Full<ApprovalRepository>,
	): Promise<ApprovalResponse | null> {
		const approval = await repo.get(Approval.ById(approvalId));
		if (!approval || approval.status === "pending") return null;
		return { status: approval.status, reason: approval.reason };
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
