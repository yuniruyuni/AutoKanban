export interface AgentAdapter {
	agentId: string;
	displayName: string;
	configPath: string;
	serversKey: string;
}

export interface IAgentConfigRepository {
	listSupportedAgents(): AgentAdapter[];
	getAdapter(agentId: string): AgentAdapter | null;
	readMcpServers(agentId: string): Record<string, unknown>;
	writeMcpServers(agentId: string, servers: Record<string, unknown>): void;
	injectServer(
		agentId: string,
		name: string,
		config: Record<string, unknown>,
	): void;
	removeServer(agentId: string, name: string): void;
}
