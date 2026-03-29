import type { ExecutionProcessLogs } from "../../models/execution-process";

export interface IExecutionProcessLogsRepository {
	getLogs(executionProcessId: string): ExecutionProcessLogs | null;
	upsertLogs(logs: ExecutionProcessLogs): void;
	appendLogs(executionProcessId: string, newLogs: string): void;
	deleteLogs(executionProcessId: string): void;
}
