import type { PgDatabase } from "../../../db/pg-client";
import type { Session } from "../../../models/session";
import { compToSQL } from "../../common";
import type { SQLFragment } from "../../sql";
import { rowToSession, type SessionRow, sessionSpecToSQL } from "./common";

export async function get(
	db: PgDatabase,
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
