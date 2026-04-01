import type { Database } from "../../../infra/db/database";
import type { SQLFragment } from "../../../infra/db/sql";
import { compToSQL } from "../../../infra/db/sql-helpers";
import type { CodingAgentProcess } from "../../../models/coding-agent-process";
import {
	type CodingAgentProcessRow,
	codingAgentProcessSpecToSQL,
	rowToCodingAgentProcess,
} from "./common";

export async function get(
	db: Database,
	spec: CodingAgentProcess.Spec,
): Promise<CodingAgentProcess | null> {
	const where = compToSQL(
		spec,
		codingAgentProcessSpecToSQL as (s: unknown) => SQLFragment,
	);
	const row = await db.queryGet<CodingAgentProcessRow>({
		query: `SELECT * FROM coding_agent_processes WHERE ${where.query} LIMIT 1`,
		params: where.params,
	});

	return row ? rowToCodingAgentProcess(row) : null;
}
