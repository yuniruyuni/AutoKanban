import type { ServiceCtx } from "../../types/db-capability";

export interface AgentAdapter {
	agentId: string;
	displayName: string;
	configPath: string;
	serversKey: string;
}

export interface AgentConfigRepository {
	listSupportedAgents(ctx: ServiceCtx): AgentAdapter[];
	getAdapter(ctx: ServiceCtx, agentId: string): AgentAdapter | null;
	readMcpServers(ctx: ServiceCtx, agentId: string): Record<string, unknown>;
	writeMcpServers(
		ctx: ServiceCtx,
		agentId: string,
		servers: Record<string, unknown>,
	): void;
	injectServer(
		ctx: ServiceCtx,
		agentId: string,
		name: string,
		config: Record<string, unknown>,
	): void;
	removeServer(ctx: ServiceCtx, agentId: string, name: string): void;
}
