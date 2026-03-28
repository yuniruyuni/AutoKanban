import type { Database } from "bun:sqlite";
import type { ExecutionProcessLogs } from "../models/execution-process";
import type { IExecutionProcessLogsRepository } from "../types/repository";

interface ExecutionProcessLogsRow {
	execution_process_id: string;
	logs: string;
}

export class ExecutionProcessLogsRepository
	implements IExecutionProcessLogsRepository
{
	constructor(private db: Database) {}

	getLogs(executionProcessId: string): ExecutionProcessLogs | null {
		const row = this.db
			.query<ExecutionProcessLogsRow, [string]>(
				`SELECT * FROM execution_process_logs WHERE execution_process_id = ?`,
			)
			.get(executionProcessId);

		return row
			? { executionProcessId: row.execution_process_id, logs: row.logs }
			: null;
	}

	upsertLogs(logs: ExecutionProcessLogs): void {
		this.db
			.query(
				`INSERT INTO execution_process_logs (execution_process_id, logs)
         VALUES (?, ?)
         ON CONFLICT(execution_process_id) DO UPDATE SET
           logs = excluded.logs`,
			)
			.run(logs.executionProcessId, logs.logs);
	}

	appendLogs(executionProcessId: string, newLogs: string): void {
		this.db
			.query(
				`INSERT INTO execution_process_logs (execution_process_id, logs)
         VALUES (?, ?)
         ON CONFLICT(execution_process_id) DO UPDATE SET
           logs = logs || excluded.logs`,
			)
			.run(executionProcessId, newLogs);
	}

	deleteLogs(executionProcessId: string): void {
		this.db
			.query(
				`DELETE FROM execution_process_logs WHERE execution_process_id = ?`,
			)
			.run(executionProcessId);
	}
}
