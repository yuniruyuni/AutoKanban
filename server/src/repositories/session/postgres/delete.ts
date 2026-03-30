import type { Database } from "../../../lib/db/database";
import type { SQLFragment } from "../../../lib/db/sql";
import { compToSQL } from "../../../lib/db/sql-helpers";
import type { Session } from "../../../models/session";
import { sessionSpecToSQL } from "./common";

export async function del(db: Database, spec: Session.Spec): Promise<number> {
	const where = compToSQL(
		spec,
		sessionSpecToSQL as (s: unknown) => SQLFragment,
	);
	const result = await db.queryRun({
		query: `DELETE FROM sessions WHERE ${where.query}`,
		params: where.params,
	});

	return result.rowCount;
}
