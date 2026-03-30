import type { Database } from "../../../infra/db/database";
import type { SQLFragment } from "../../../infra/db/sql";
import { compToSQL } from "../../../infra/db/sql-helpers";
import type { CodingAgentTurn } from "../../../models/coding-agent-turn";
import {
	type CodingAgentTurnRow,
	codingAgentTurnSpecToSQL,
	rowToCodingAgentTurn,
} from "./common";

export async function get(
	db: Database,
	spec: CodingAgentTurn.Spec,
): Promise<CodingAgentTurn | null> {
	const where = compToSQL(
		spec,
		codingAgentTurnSpecToSQL as (s: unknown) => SQLFragment,
	);
	const row = await db.queryGet<CodingAgentTurnRow>({
		query: `SELECT * FROM coding_agent_turns WHERE ${where.query} LIMIT 1`,
		params: where.params,
	});

	return row ? rowToCodingAgentTurn(row) : null;
}
