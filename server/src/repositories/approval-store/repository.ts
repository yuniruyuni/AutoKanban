import type { Approval } from "../../models/approval";
import type { IApprovalRepository } from "../../types/repository";

export interface IApprovalStore {
	createAndWait(
		approval: Approval,
		repo: IApprovalRepository,
	): Promise<{ status: Approval.Status; reason: string | null }>;
	respond(
		id: string,
		status: "approved" | "denied",
		reason: string | null,
		repo: IApprovalRepository,
	): Promise<boolean>;
	getRespondedStatus(
		approvalId: string,
		repo: IApprovalRepository,
	): Promise<{ status: Approval.Status; reason: string | null } | null>;
	hasPending(executionProcessId: string): boolean;
	listPending(executionProcessId: string): Approval[];
	clear(): void;
}
