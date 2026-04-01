import { type SQLFragment, sql } from "../../../infra/db/sql";
import { dateFromSQL } from "../../../infra/db/sql-helpers";
import type { CodingAgentProcess } from "../../../models/coding-agent-process";

export interface CodingAgentProcessRow {
	id: string;
	session_id: string;
	status: string;
	exit_code: number | null;
	started_at: Date;
	completed_at: Date | null;
	created_at: Date;
	updated_at: Date;
}

type CodingAgentProcessSpecData =
	| { type: "ById"; id: string }
	| { type: "BySessionId"; sessionId: string }
	| { type: "ByStatus"; status: CodingAgentProcess.Status };

export function codingAgentProcessSpecToSQL(
	spec: CodingAgentProcessSpecData,
): SQLFragment {
	switch (spec.type) {
		case "ById":
			return sql`id = ${spec.id}`;
		case "BySessionId":
			return sql`session_id = ${spec.sessionId}`;
		case "ByStatus":
			return sql`status = ${spec.status}`;
	}
}

export function rowToCodingAgentProcess(
	row: CodingAgentProcessRow,
): CodingAgentProcess {
	return {
		id: row.id,
		sessionId: row.session_id,
		status: row.status as CodingAgentProcess.Status,
		exitCode: row.exit_code,
		startedAt: dateFromSQL(row.started_at),
		completedAt: row.completed_at ? dateFromSQL(row.completed_at) : null,
		createdAt: dateFromSQL(row.created_at),
		updatedAt: dateFromSQL(row.updated_at),
	};
}

export function columnName(key: CodingAgentProcess.SortKey): string {
	const map: Record<CodingAgentProcess.SortKey, string> = {
		createdAt: "created_at",
		startedAt: "started_at",
		id: "id",
	};
	return map[key];
}
