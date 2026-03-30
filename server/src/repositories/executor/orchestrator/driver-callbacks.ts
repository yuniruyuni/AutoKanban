import type { DriverApprovalRequest } from "./driver-approval-request";

/**
 * Events the driver emits to the orchestrator (ExecutorRepository).
 */
export interface DriverCallbacks {
	onIdle: (processId: string) => void;
	onApprovalRequest: (
		processId: string,
		request: DriverApprovalRequest,
	) => void;
	onSessionInfo: (
		processId: string,
		info: { resumeToken: string | null; messageToken: string | null },
	) => void;
	onSummary: (processId: string, summary: string) => void;
	onLogData: (
		processId: string,
		source: "stdout" | "stderr",
		data: string,
	) => void;
}
