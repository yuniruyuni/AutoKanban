import { type SQLFragment, sql } from "../../../infra/db/sql";
import { dateFromSQL } from "../../../infra/db/sql-helpers";
import type { WorkspaceScriptProcess } from "../../../models/workspace-script-process";

export interface WorkspaceScriptProcessRow {
	id: string;
	session_id: string;
	script_type: string;
	status: string;
	exit_code: number | null;
	started_at: Date;
	completed_at: Date | null;
	created_at: Date;
	updated_at: Date;
}

type WorkspaceScriptProcessSpecData =
	| { type: "ById"; id: string }
	| { type: "BySessionId"; sessionId: string }
	| { type: "ByStatus"; status: WorkspaceScriptProcess.Status }
	| { type: "ByScriptType"; scriptType: WorkspaceScriptProcess.ScriptType };

export function workspaceScriptProcessSpecToSQL(
	spec: WorkspaceScriptProcessSpecData,
): SQLFragment {
	switch (spec.type) {
		case "ById":
			return sql`id = ${spec.id}`;
		case "BySessionId":
			return sql`session_id = ${spec.sessionId}`;
		case "ByStatus":
			return sql`status = ${spec.status}`;
		case "ByScriptType":
			return sql`script_type = ${spec.scriptType}`;
	}
}

export function rowToWorkspaceScriptProcess(
	row: WorkspaceScriptProcessRow,
): WorkspaceScriptProcess {
	return {
		id: row.id,
		sessionId: row.session_id,
		scriptType: row.script_type as WorkspaceScriptProcess.ScriptType,
		status: row.status as WorkspaceScriptProcess.Status,
		exitCode: row.exit_code,
		startedAt: dateFromSQL(row.started_at),
		completedAt: row.completed_at ? dateFromSQL(row.completed_at) : null,
		createdAt: dateFromSQL(row.created_at),
		updatedAt: dateFromSQL(row.updated_at),
	};
}

export function columnName(key: WorkspaceScriptProcess.SortKey): string {
	const map: Record<WorkspaceScriptProcess.SortKey, string> = {
		createdAt: "created_at",
		startedAt: "started_at",
		id: "id",
	};
	return map[key];
}
