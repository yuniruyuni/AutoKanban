import { proxy } from "valtio";

export interface ExecutionInfo {
	executionProcessId: string;
	sessionId: string;
	workspaceId: string;
	status: "running" | "completed" | "failed" | "killed" | "awaiting_approval";
}

interface ExecutionState {
	activeExecutions: Record<string, ExecutionInfo>; // taskId -> ExecutionInfo
}

export const executionStore = proxy<ExecutionState>({
	activeExecutions: {},
});

export const executionActions = {
	startExecution(
		taskId: string,
		executionProcessId: string,
		sessionId: string,
		workspaceId: string,
	) {
		executionStore.activeExecutions[taskId] = {
			executionProcessId,
			sessionId,
			workspaceId,
			status: "running",
		};
	},

	/**
	 * Set execution info directly (used for restoring state after page reload).
	 */
	setExecutionInfo(
		taskId: string,
		info: Omit<ExecutionInfo, "workspaceId"> & { workspaceId?: string },
	) {
		executionStore.activeExecutions[taskId] = {
			executionProcessId: info.executionProcessId,
			sessionId: info.sessionId,
			workspaceId: info.workspaceId ?? "",
			status: info.status,
		};
	},

	updateExecutionStatus(
		taskId: string,
		status: "running" | "completed" | "failed" | "killed" | "awaiting_approval",
	) {
		if (executionStore.activeExecutions[taskId]) {
			executionStore.activeExecutions[taskId].status = status;
		}
	},

	clearExecution(taskId: string) {
		delete executionStore.activeExecutions[taskId];
	},

	getExecution(taskId: string): ExecutionInfo | undefined {
		return executionStore.activeExecutions[taskId];
	},

	isTaskExecuting(taskId: string): boolean {
		const execution = executionStore.activeExecutions[taskId];
		return execution?.status === "running";
	},
};
