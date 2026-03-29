import type { PgDatabase } from "../../../db/pg-client";
import type { ExecutionProcessLogs } from "../../../models/execution-process";
import type { IExecutionProcessLogsRepository } from "../repository";
import { appendLogs } from "./append-logs";
import { deleteLogs } from "./delete-logs";
import { getLogs } from "./get-logs";
import { upsertLogs } from "./upsert-logs";

export class ExecutionProcessLogsRepository
	implements IExecutionProcessLogsRepository
{
	constructor(private db: PgDatabase) {}

	async getLogs(
		executionProcessId: string,
	): Promise<ExecutionProcessLogs | null> {
		return getLogs(this.db, executionProcessId);
	}

	async upsertLogs(logs: ExecutionProcessLogs): Promise<void> {
		await upsertLogs(this.db, logs);
	}

	async appendLogs(executionProcessId: string, newLogs: string): Promise<void> {
		await appendLogs(this.db, executionProcessId, newLogs);
	}

	async deleteLogs(executionProcessId: string): Promise<void> {
		await deleteLogs(this.db, executionProcessId);
	}
}
