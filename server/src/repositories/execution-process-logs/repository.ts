import type { ExecutionProcessLogs } from "../../models/execution-process";

export interface IExecutionProcessLogsRepository {
	getLogs(executionProcessId: string): Promise<ExecutionProcessLogs | null>;
	upsertLogs(logs: ExecutionProcessLogs): Promise<void>;
	appendLogs(executionProcessId: string, newLogs: string): Promise<void>;
	deleteLogs(executionProcessId: string): Promise<void>;
}
