import type { DriverApprovalRequest } from "../../models/driver-approval-request";
import type { Context } from "../../usecases/context";
import type {
	CallbackClient,
	LogDataInfo,
	ProcessCompletionInfo,
	ProcessIdleInfo,
	SessionInfoUpdate,
	SummaryInfo,
} from "./client";
import { handleApprovalRequest } from "./routers/on-approval-request";
import { handleLogData } from "./routers/on-log-data";
import { handleProcessComplete } from "./routers/on-process-complete";
import { handleProcessIdle } from "./routers/on-process-idle";
import { handleSessionInfo } from "./routers/on-session-info";
import { handleSummary } from "./routers/on-summary";

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

	async onLogData(info: LogDataInfo): Promise<void> {
		if (!this.ctx) throw new Error("CallbackClient not initialized");
		await handleLogData(this.ctx, info);
	}

	async onSessionInfo(info: SessionInfoUpdate): Promise<void> {
		if (!this.ctx) throw new Error("CallbackClient not initialized");
		await handleSessionInfo(this.ctx, info);
	}

	async onSummary(info: SummaryInfo): Promise<void> {
		if (!this.ctx) throw new Error("CallbackClient not initialized");
		await handleSummary(this.ctx, info);
	}
}
