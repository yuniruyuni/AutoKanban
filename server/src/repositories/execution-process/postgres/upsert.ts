import type { Database } from "../../../infra/db/database";
import { dateToSQL } from "../../../infra/db/sql-helpers";
import type { ExecutionProcess } from "../../../models/execution-process";

export async function upsert(
	db: Database,
	process: ExecutionProcess,
): Promise<void> {
	await db.queryRun({
		query: `INSERT INTO execution_processes (id, session_id, run_reason, status, exit_code, started_at, completed_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           status = excluded.status,
           exit_code = excluded.exit_code,
           completed_at = excluded.completed_at,
           updated_at = excluded.updated_at`,
		params: [
			process.id,
			process.sessionId,
			process.runReason,
			process.status,
			process.exitCode,
			dateToSQL(process.startedAt),
			process.completedAt ? dateToSQL(process.completedAt) : null,
			dateToSQL(process.createdAt),
			dateToSQL(process.updatedAt),
		],
	});
}
