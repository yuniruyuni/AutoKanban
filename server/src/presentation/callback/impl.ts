import type { DriverApprovalRequest } from "../../repositories/executor/orchestrator/driver-approval-request";
import type { Context } from "../../usecases/context";
import type {
	CallbackClient,
	ProcessCompletionInfo,
	ProcessIdleInfo,
} from "./client";
import { handleApprovalRequest } from "./routers/on-approval-request";
import { handleProcessComplete } from "./routers/on-process-complete";
import { handleProcessIdle } from "./routers/on-process-idle";

/**
 * CallbackClient implementation.
 * Delegates to presentation/callback/routers which invoke usecases.
 * Must be initialized with Context after construction.
 */
export class CallbackClientImpl implements CallbackClient {
	private ctx: Context | null = null;

	initialize(ctx: Context): void {
		this.ctx = ctx;
	}

	async onProcessComplete(info: ProcessCompletionInfo): Promise<void> {
		if (!this.ctx) throw new Error("CallbackClient not initialized");
		await handleProcessComplete(this.ctx, info);
	}

	async onProcessIdle(info: ProcessIdleInfo): Promise<void> {
		if (!this.ctx) throw new Error("CallbackClient not initialized");
		await handleProcessIdle(this.ctx, info);
	}

	async onApprovalRequest(
		processId: string,
		request: DriverApprovalRequest,
	): Promise<void> {
		if (!this.ctx) throw new Error("CallbackClient not initialized");
		await handleApprovalRequest(this.ctx, processId, request);
	}
}
