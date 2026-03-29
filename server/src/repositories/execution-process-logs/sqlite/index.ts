import type { Database } from "bun:sqlite";
import type { ExecutionProcessLogs } from "../../../models/execution-process";
import type { IExecutionProcessLogsRepository } from "../repository";
import { appendLogs } from "./append-logs";
import { deleteLogs } from "./delete-logs";
import { getLogs } from "./get-logs";
import { upsertLogs } from "./upsert-logs";

export class ExecutionProcessLogsRepository
	implements IExecutionProcessLogsRepository
{
	constructor(private db: Database) {}

	getLogs(executionProcessId: string): ExecutionProcessLogs | null {
		return getLogs(this.db, executionProcessId);
	}

	upsertLogs(logs: ExecutionProcessLogs): void {
		upsertLogs(this.db, logs);
	}

	appendLogs(executionProcessId: string, newLogs: string): void {
		appendLogs(this.db, executionProcessId, newLogs);
	}

	deleteLogs(executionProcessId: string): void {
		deleteLogs(this.db, executionProcessId);
	}
}
