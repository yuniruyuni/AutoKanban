import type { CodingAgentProcess } from "../../models/coding-agent-process";
import type { DevServerProcess } from "../../models/dev-server-process";
import type { DriverApprovalRequest } from "../../models/driver-approval-request";
import type { WorkspaceScriptProcess } from "../../models/workspace-script-process";

export type ProcessType = "codingagent" | "devserver" | "workspacescript";

export interface ProcessCompletionInfo {
	processId: string;
	sessionId: string;
	processType: ProcessType;
	status:
		| CodingAgentProcess.Status
		| DevServerProcess.Status
		| WorkspaceScriptProcess.Status;
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
