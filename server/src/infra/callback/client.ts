import type { DriverApprovalRequest } from "../../models/driver-approval-request";
import type { ExecutionProcess } from "../../models/execution-process";

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

export interface LogDataInfo {
	processId: string;
	sessionId: string;
	source: "stdout" | "stderr";
	data: string;
}

export interface SessionInfoUpdate {
	processId: string;
	sessionId: string;
	agentSessionId: string | null;
	agentMessageId: string | null;
}

export interface SummaryInfo {
	processId: string;
	sessionId: string;
	summary: string;
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
	onLogData(info: LogDataInfo): Promise<void>;
	onSessionInfo(info: SessionInfoUpdate): Promise<void>;
	onSummary(info: SummaryInfo): Promise<void>;
}
