import type { CodingAgent } from "../../models/agent";
import type { AgentLogParser } from "../../models/agent/parser";
import type { DbReadCtx } from "../common";

export interface AgentRepository {
	get(ctx: DbReadCtx, agentId: string | null | undefined): CodingAgent | null;
	list(ctx: DbReadCtx): CodingAgent[];
	getParser(ctx: DbReadCtx, agentId: string | null | undefined): AgentLogParser;
}
