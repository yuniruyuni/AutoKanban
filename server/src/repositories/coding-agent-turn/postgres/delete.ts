import type { Database } from "../../common";
import type { CodingAgentTurn } from "../../../models/coding-agent-turn";
import { compToSQL } from "../../common";
import type { SQLFragment } from "../../common";
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
