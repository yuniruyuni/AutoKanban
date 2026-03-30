import type { Database } from "../../../lib/db/database";
import type { SQLFragment } from "../../../lib/db/sql";
import { compToSQL } from "../../../lib/db/sql-helpers";
import type { Session } from "../../../models/session";
import { rowToSession, type SessionRow, sessionSpecToSQL } from "./common";

export async function get(
	db: Database,
	spec: Session.Spec,
): Promise<Session | null> {
	const where = compToSQL(
		spec,
		sessionSpecToSQL as (s: unknown) => SQLFragment,
	);
	const row = await db.queryGet<SessionRow>({
		query: `SELECT * FROM sessions WHERE ${where.query} LIMIT 1`,
		params: where.params,
	});

	return row ? rowToSession(row) : null;
}
