import type { AgentConfigRepository } from "../repository";

export function createMockAgentConfigRepository(
	overrides: Partial<AgentConfigRepository> = {},
): AgentConfigRepository {
	return {
		listSupportedAgents: () => [],
		getAdapter: () => null,
		readMcpServers: () => ({}),
		writeMcpServers: () => {},
		injectServer: () => {},
		removeServer: () => {},
		...overrides,
	} as AgentConfigRepository;
}
