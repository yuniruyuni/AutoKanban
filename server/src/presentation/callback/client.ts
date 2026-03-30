import type { ExecutionProcess } from "../../models/execution-process";
import type { DriverApprovalRequest } from "../../repositories/executor/orchestrator/driver-approval-request";

export interface ProcessCompletionInfo {
	processId: string;
	sessionId: string;
	status: ExecutionProcess.Status;
	exitCode: number | null;
}

export interface ProcessIdleInfo {
	processId: string;
	sessionId: string;
}

/**
 * Callback client interface.
 * Repositories call these methods to trigger presentation-layer handlers.
 * The implementation invokes usecases internally.
 */
export interface CallbackClient {
	onProcessComplete(info: ProcessCompletionInfo): Promise<void>;
	onProcessIdle(info: ProcessIdleInfo): Promise<void>;
	onApprovalRequest(
		processId: string,
		request: DriverApprovalRequest,
	): Promise<void>;
}
