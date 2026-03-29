import type { ICodingAgentTurnRepository } from "../repository";

export function createMockCodingAgentTurnRepository(
	overrides: Partial<ICodingAgentTurnRepository> = {},
): ICodingAgentTurnRepository {
	return {
		get: async () => null,
		list: async () => ({ items: [], hasMore: false }),
		upsert: async () => {},
		delete: async () => 0,
		updateAgentSessionId: async () => {},
		updateAgentMessageId: async () => {},
		updateSummary: async () => {},
		findLatestResumeInfo: async () => null,
		findLatestResumeInfoByWorkspaceId: async () => null,
		...overrides,
	} as ICodingAgentTurnRepository;
}
