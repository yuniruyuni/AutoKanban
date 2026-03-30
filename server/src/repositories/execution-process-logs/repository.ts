import type { ExecutionProcessLogs } from "../../models/execution-process";
import type {
	DbReadCtx,
	DbWriteCtx,
	StripMarkers,
} from "../../types/db-capability";

export interface IExecutionProcessLogsRepositoryDef {
	getLogs(
		ctx: DbReadCtx,
		executionProcessId: string,
	): Promise<ExecutionProcessLogs | null>;
	upsertLogs(ctx: DbWriteCtx, logs: ExecutionProcessLogs): Promise<void>;
	appendLogs(
		ctx: DbWriteCtx,
		executionProcessId: string,
		newLogs: string,
	): Promise<void>;
	deleteLogs(ctx: DbWriteCtx, executionProcessId: string): Promise<void>;
}

export type IExecutionProcessLogsRepository =
	StripMarkers<IExecutionProcessLogsRepositoryDef>;
