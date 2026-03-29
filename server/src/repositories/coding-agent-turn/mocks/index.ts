import type { ICodingAgentTurnRepository } from "../repository";

export function createMockCodingAgentTurnRepository(
	overrides: Partial<ICodingAgentTurnRepository> = {},
): ICodingAgentTurnRepository {
	return {
		get: () => null,
		list: () => ({ items: [], hasMore: false }),
		upsert: () => {},
		delete: () => 0,
		updateAgentSessionId: () => {},
		updateAgentMessageId: () => {},
		updateSummary: () => {},
		findLatestResumeInfo: () => null,
		findLatestResumeInfoByWorkspaceId: () => null,
		...overrides,
	} as ICodingAgentTurnRepository;
}
