import type { DbReadCtx, DbWriteCtx } from "../../../types/db-capability";
import type { ICodingAgentTurnRepositoryDef } from "../repository";

export function createMockCodingAgentTurnRepository(
	overrides: Partial<ICodingAgentTurnRepositoryDef> = {},
): ICodingAgentTurnRepositoryDef {
	return {
		get: async (_ctx: DbReadCtx) => null,
		list: async (_ctx: DbReadCtx) => ({ items: [], hasMore: false }),
		upsert: async (_ctx: DbWriteCtx) => {},
		delete: async (_ctx: DbWriteCtx) => 0,
		updateAgentSessionId: async (_ctx: DbWriteCtx) => {},
		updateAgentMessageId: async (_ctx: DbWriteCtx) => {},
		updateSummary: async (_ctx: DbWriteCtx) => {},
		findLatestResumeInfo: async (_ctx: DbReadCtx) => null,
		findLatestResumeInfoByWorkspaceId: async (_ctx: DbReadCtx) => null,
		...overrides,
	} as ICodingAgentTurnRepositoryDef;
}
