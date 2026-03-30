import type { Database } from "../../../lib/db/database";
import type { SQLFragment } from "../../../lib/db/sql";
import { compToSQL } from "../../../lib/db/sql-helpers";
import type { CodingAgentTurn } from "../../../models/coding-agent-turn";
import { codingAgentTurnSpecToSQL } from "./common";

export async function del(
	db: Database,
	spec: CodingAgentTurn.Spec,
): Promise<number> {
	const where = compToSQL(
		spec,
		codingAgentTurnSpecToSQL as (s: unknown) => SQLFragment,
	);
	const result = await db.queryRun({
		query: `DELETE FROM coding_agent_turns WHERE ${where.query}`,
		params: where.params,
	});

	return result.rowCount;
}
