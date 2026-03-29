import { Approval } from "../../../models/approval";
import type { IApprovalRepository } from "../../../types/repository";
import type { IApprovalStore } from "../repository";

export interface ApprovalResponse {
	status: Approval.Status;
	reason: string | null;
}

interface PendingApproval {
	approval: Approval;
	resolve: (response: ApprovalResponse) => void;
}

export class ApprovalStore implements IApprovalStore {
	private pending = new Map<string, PendingApproval>();

	async createAndWait(
		approval: Approval,
		repo: IApprovalRepository,
	): Promise<ApprovalResponse> {
		repo.upsert(approval);

		const existing = repo.get(Approval.ById(approval.id));
		if (existing && existing.status !== "pending") {
			return { status: existing.status, reason: existing.reason };
		}

		return new Promise<ApprovalResponse>((resolve) => {
			this.pending.set(approval.id, { approval, resolve });
		});
	}

	respond(
		id: string,
		status: "approved" | "denied",
		reason: string | null,
		repo: IApprovalRepository,
	): boolean {
		const existing = repo.get(Approval.ById(id));
		if (!existing) return false;

		const updated = Approval.respond(existing, status, reason);
		repo.upsert(updated);

		const pending = this.pending.get(id);
		if (pending) {
			pending.resolve({ status, reason });
			this.pending.delete(id);
			return true;
		}

		return true;
	}

	getRespondedStatus(
		approvalId: string,
		repo: IApprovalRepository,
	): ApprovalResponse | null {
		const approval = repo.get(Approval.ById(approvalId));
		if (!approval || approval.status === "pending") return null;
		return { status: approval.status, reason: approval.reason };
	}

	hasPending(executionProcessId: string): boolean {
		for (const [, pending] of this.pending) {
			if (pending.approval.executionProcessId === executionProcessId) {
				return true;
			}
		}
		return false;
	}

	listPending(executionProcessId: string): Approval[] {
		const result: Approval[] = [];
		for (const [, pending] of this.pending) {
			if (pending.approval.executionProcessId === executionProcessId) {
				result.push(pending.approval);
			}
		}
		return result;
	}

	clear(): void {
		this.pending.clear();
	}
}

export const approvalStore = new ApprovalStore();
