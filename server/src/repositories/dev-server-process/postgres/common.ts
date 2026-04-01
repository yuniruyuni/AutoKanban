import { type SQLFragment, sql } from "../../../infra/db/sql";
import { dateFromSQL } from "../../../infra/db/sql-helpers";
import type { DevServerProcess } from "../../../models/dev-server-process";

export interface DevServerProcessRow {
	id: string;
	session_id: string;
	status: string;
	exit_code: number | null;
	started_at: Date;
	completed_at: Date | null;
	created_at: Date;
	updated_at: Date;
}

type DevServerProcessSpecData =
	| { type: "ById"; id: string }
	| { type: "BySessionId"; sessionId: string }
	| { type: "ByStatus"; status: DevServerProcess.Status };

export function devServerProcessSpecToSQL(
	spec: DevServerProcessSpecData,
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

export function rowToDevServerProcess(
	row: DevServerProcessRow,
): DevServerProcess {
	return {
		id: row.id,
		sessionId: row.session_id,
		status: row.status as DevServerProcess.Status,
		exitCode: row.exit_code,
		startedAt: dateFromSQL(row.started_at),
		completedAt: row.completed_at ? dateFromSQL(row.completed_at) : null,
		createdAt: dateFromSQL(row.created_at),
		updatedAt: dateFromSQL(row.updated_at),
	};
}

export function columnName(key: DevServerProcess.SortKey): string {
	const map: Record<DevServerProcess.SortKey, string> = {
		createdAt: "created_at",
		startedAt: "started_at",
		id: "id",
	};
	return map[key];
}
