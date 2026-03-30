import type { Approval } from "../../models/approval";
import type { ServiceCtx } from "../common";

export interface ApprovalStoreRepository {
	createAndWait(
		ctx: ServiceCtx,
		approval: Approval,
	): Promise<{ status: Approval.Status; reason: string | null }>;
	respond(
		ctx: ServiceCtx,
		id: string,
		status: "approved" | "denied",
		reason: string | null,
	): Promise<boolean>;
	hasPending(ctx: ServiceCtx, executionProcessId: string): boolean;
	listPending(ctx: ServiceCtx, executionProcessId: string): Approval[];
	clear(ctx: ServiceCtx): void;
}
