import type { IAgentConfigRepository } from "../repository";

export function createMockAgentConfigRepository(
	overrides: Partial<IAgentConfigRepository> = {},
): IAgentConfigRepository {
	return {
		listSupportedAgents: () => [],
		getAdapter: () => null,
		readMcpServers: () => ({}),
		writeMcpServers: () => {},
		injectServer: () => {},
		removeServer: () => {},
		...overrides,
	} as IAgentConfigRepository;
}
