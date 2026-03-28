/**
 * In-memory bridge between DB-persisted approvals and the agent process.
 * Uses Promises to block the agent until user responds.
 */

import { Approval } from "../models/approval";
import type { IApprovalRepository, IApprovalStore } from "../types/repository";

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

	/**
	 * Persist approval to DB and wait for user response via Promise.
	 * Returns when respond() is called for this approval.
	 */
	async createAndWait(
		approval: Approval,
		repo: IApprovalRepository,
	): Promise<ApprovalResponse> {
		// Persist to DB first
		repo.upsert(approval);

		// Check if already responded in DB (server restart case)
		const existing = repo.get(Approval.ById(approval.id));
		if (existing && existing.status !== "pending") {
			return { status: existing.status, reason: existing.reason };
		}

		// Wait for user response
		return new Promise<ApprovalResponse>((resolve) => {
			this.pending.set(approval.id, { approval, resolve });
		});
	}

	/**
	 * User responds to an approval. Updates DB and resolves the waiting Promise.
	 */
	respond(
		id: string,
		status: "approved" | "denied",
		reason: string | null,
		repo: IApprovalRepository,
	): boolean {
		// Update DB
		const existing = repo.get(Approval.ById(id));
		if (!existing) return false;

		const updated = Approval.respond(existing, status, reason);
		repo.upsert(updated);

		// Resolve waiting Promise
		const pending = this.pending.get(id);
		if (pending) {
			pending.resolve({ status, reason });
			this.pending.delete(id);
			return true;
		}

		return true;
	}

	/**
	 * Check if there's a pending approval already responded in DB.
	 * Used for server restart recovery.
	 */
	getRespondedStatus(
		approvalId: string,
		repo: IApprovalRepository,
	): ApprovalResponse | null {
		const approval = repo.get(Approval.ById(approvalId));
		if (!approval || approval.status === "pending") return null;
		return { status: approval.status, reason: approval.reason };
	}

	/**
	 * Check if there are any pending approvals for a given process.
	 */
	hasPending(executionProcessId: string): boolean {
		for (const [, pending] of this.pending) {
			if (pending.approval.executionProcessId === executionProcessId) {
				return true;
			}
		}
		return false;
	}

	/**
	 * Get all pending approvals for a given process.
	 */
	listPending(executionProcessId: string): Approval[] {
		const result: Approval[] = [];
		for (const [, pending] of this.pending) {
			if (pending.approval.executionProcessId === executionProcessId) {
				result.push(pending.approval);
			}
		}
		return result;
	}

	/**
	 * Clear all pending approvals (for cleanup).
	 */
	clear(): void {
		this.pending.clear();
	}
}

export const approvalStore = new ApprovalStore();
