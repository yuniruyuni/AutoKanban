import type { Database } from "../../../lib/db/database";
import { dateToSQL } from "../../../lib/db/sql-helpers";
import type { Session } from "../../../models/session";

export async function upsert(db: Database, session: Session): Promise<void> {
	await db.queryRun({
		query: `INSERT INTO sessions (id, workspace_id, executor, variant, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           executor = excluded.executor,
           variant = excluded.variant,
           updated_at = excluded.updated_at`,
		params: [
			session.id,
			session.workspaceId,
			session.executor,
			session.variant,
			dateToSQL(session.createdAt),
			dateToSQL(session.updatedAt),
		],
	});
}
