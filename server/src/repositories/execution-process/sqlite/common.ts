import type { ExecutionProcess } from "../../../models/execution-process";
import { dateFromSQL } from "../../common";
import { type SQLFragment, sql } from "../../sql";

export interface ExecutionProcessRow {
	id: string;
	session_id: string;
	run_reason: string;
	status: string;
	exit_code: number | null;
	started_at: string;
	completed_at: string | null;
	created_at: string;
	updated_at: string;
}

type ExecutionProcessSpecData =
	| { type: "ById"; id: string }
	| { type: "BySessionId"; sessionId: string }
	| { type: "ByStatus"; status: ExecutionProcess.Status }
	| { type: "ByRunReason"; runReason: ExecutionProcess.RunReason };

export function executionProcessSpecToSQL(
	spec: ExecutionProcessSpecData,
): SQLFragment {
	switch (spec.type) {
		case "ById":
			return sql`id = ${spec.id}`;
		case "BySessionId":
			return sql`session_id = ${spec.sessionId}`;
		case "ByStatus":
			return sql`status = ${spec.status}`;
		case "ByRunReason":
			return sql`run_reason = ${spec.runReason}`;
	}
}

export function rowToExecutionProcess(
	row: ExecutionProcessRow,
): ExecutionProcess {
	return {
		id: row.id,
		sessionId: row.session_id,
		runReason: row.run_reason as ExecutionProcess.RunReason,
		status: row.status as ExecutionProcess.Status,
		exitCode: row.exit_code,
		startedAt: dateFromSQL(row.started_at),
		completedAt: row.completed_at ? dateFromSQL(row.completed_at) : null,
		createdAt: dateFromSQL(row.created_at),
		updatedAt: dateFromSQL(row.updated_at),
	};
}

export function columnName(key: ExecutionProcess.SortKey): string {
	const map: Record<ExecutionProcess.SortKey, string> = {
		createdAt: "created_at",
		startedAt: "started_at",
		id: "id",
	};
	return map[key];
}
