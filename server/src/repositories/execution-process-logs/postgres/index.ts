import type { ExecutionProcessLogs } from "../../../models/execution-process";
import type { DbReadCtx, DbWriteCtx } from "../../../types/db-capability";
import type { ExecutionProcessLogsRepository as IExecutionProcessLogsRepository } from "../repository";
import { appendLogs } from "./append-logs";
import { deleteLogs } from "./delete-logs";
import { getLogs } from "./get-logs";
import { upsertLogs } from "./upsert-logs";

export class ExecutionProcessLogsRepository
	implements IExecutionProcessLogsRepository
{
	async getLogs(
		ctx: DbReadCtx,
		executionProcessId: string,
	): Promise<ExecutionProcessLogs | null> {
		return getLogs(ctx.db, executionProcessId);
	}

	async upsertLogs(ctx: DbWriteCtx, logs: ExecutionProcessLogs): Promise<void> {
		await upsertLogs(ctx.db, logs);
	}

	async appendLogs(
		ctx: DbWriteCtx,
		executionProcessId: string,
		newLogs: string,
	): Promise<void> {
		await appendLogs(ctx.db, executionProcessId, newLogs);
	}

	async deleteLogs(ctx: DbWriteCtx, executionProcessId: string): Promise<void> {
		await deleteLogs(ctx.db, executionProcessId);
	}
}
