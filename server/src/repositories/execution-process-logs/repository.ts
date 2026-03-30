import type { ExecutionProcessLogs } from "../../models/execution-process";
import type { DbReadCtx, DbWriteCtx } from "../common";

export interface ExecutionProcessLogsRepository {
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
