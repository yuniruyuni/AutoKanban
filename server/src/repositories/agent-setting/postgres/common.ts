import { type SQLFragment, sql } from "../../../infra/db/sql";
import { dateFromSQL } from "../../../infra/db/sql-helpers";
import type { AgentSetting } from "../../../models/agent-setting";

export interface AgentSettingRow {
	agent_id: string;
	command: string;
	created_at: Date;
	updated_at: Date;
}

type AgentSettingSpecData = { type: "ById"; agentId: string };

export function agentSettingSpecToSQL(spec: AgentSettingSpecData): SQLFragment {
	switch (spec.type) {
		case "ById":
			return sql`agent_id = ${spec.agentId}`;
	}
}

export function rowToAgentSetting(row: AgentSettingRow): AgentSetting {
	return {
		agentId: row.agent_id,
		command: row.command,
		createdAt: dateFromSQL(row.created_at),
		updatedAt: dateFromSQL(row.updated_at),
	};
}
