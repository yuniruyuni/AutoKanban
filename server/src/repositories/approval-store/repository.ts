import type { Approval } from "../../models/approval";
import type { ApprovalRepository } from "../approval/repository";
import type { Full, ServiceCtx } from "../common";

export interface ApprovalStoreRepository {
	createAndWait(
		ctx: ServiceCtx,
		approval: Approval,
		repo: Full<ApprovalRepository>,
	): Promise<{ status: Approval.Status; reason: string | null }>;
	respond(
		ctx: ServiceCtx,
		id: string,
		status: "approved" | "denied",
		reason: string | null,
		repo: Full<ApprovalRepository>,
	): Promise<boolean>;
	getRespondedStatus(
		ctx: ServiceCtx,
		approvalId: string,
		repo: Full<ApprovalRepository>,
	): Promise<{ status: Approval.Status; reason: string | null } | null>;
	hasPending(ctx: ServiceCtx, executionProcessId: string): boolean;
	listPending(ctx: ServiceCtx, executionProcessId: string): Approval[];
	clear(ctx: ServiceCtx): void;
}
