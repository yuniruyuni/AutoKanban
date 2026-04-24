import {
	type AgentCatalog,
	type CodingAgent,
	defaultAgentCatalog,
} from "../../models/agent";
import type { AgentLogParser } from "../../models/agent/parser";
import type { DbReadCtx } from "../common";
import type { AgentRepository as AgentRepositoryDef } from "./repository";

export class AgentRepository implements AgentRepositoryDef {
	constructor(private readonly catalog: AgentCatalog = defaultAgentCatalog) {}

	get(_ctx: DbReadCtx, agentId: string | null | undefined): CodingAgent | null {
		return this.catalog.get(agentId);
	}

	list(_ctx: DbReadCtx): CodingAgent[] {
		return this.catalog.list();
	}

	getParser(
		_ctx: DbReadCtx,
		agentId: string | null | undefined,
	): AgentLogParser {
		return this.catalog.require(agentId).createParser();
	}
}
