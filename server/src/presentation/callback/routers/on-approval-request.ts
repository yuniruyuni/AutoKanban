import type { DriverApprovalRequest } from "../../../models/driver-approval-request";
import type { Context } from "../../../usecases/context";
import { handleApprovalRequest as handleApprovalRequestUsecase } from "../../../usecases/execution/on-approval-request";

export async function handleApprovalRequest(
	ctx: Context,
	processId: string,
	request: DriverApprovalRequest,
): Promise<void> {
	await handleApprovalRequestUsecase({ processId, request }).run(ctx);
}
