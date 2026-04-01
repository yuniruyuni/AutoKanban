import type { Database } from "../../../infra/db/database";
import type { SQLFragment } from "../../../infra/db/sql";
import { compToSQL } from "../../../infra/db/sql-helpers";
import type { CodingAgentProcess } from "../../../models/coding-agent-process";
import { codingAgentProcessSpecToSQL } from "./common";

export async function del(
	db: Database,
	spec: CodingAgentProcess.Spec,
): Promise<number> {
	const where = compToSQL(
		spec,
		codingAgentProcessSpecToSQL as (s: unknown) => SQLFragment,
	);
	const result = await db.queryRun({
		query: `DELETE FROM coding_agent_processes WHERE ${where.query}`,
		params: where.params,
	});

	return result.rowCount;
}
