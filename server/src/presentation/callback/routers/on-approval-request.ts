import type { Context } from "../../../usecases/context";
import type { DriverApprovalRequest } from "../../../repositories/executor/orchestrator/driver-approval-request";
import { handleApprovalRequest as handleApprovalRequestUsecase } from "../../../usecases/execution/on-approval-request";

export async function handleApprovalRequest(
	ctx: Context,
	processId: string,
	request: DriverApprovalRequest,
): Promise<void> {
	await handleApprovalRequestUsecase({ processId, request }).run(ctx);
}
