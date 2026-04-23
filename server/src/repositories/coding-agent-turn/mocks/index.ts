import type { DbReadCtx, DbWriteCtx } from "../../common";
import type { CodingAgentTurnRepository } from "../repository";

export function createMockCodingAgentTurnRepository(
	overrides: Partial<CodingAgentTurnRepository> = {},
): CodingAgentTurnRepository {
	return {
		get: async (_ctx: DbReadCtx) => null,
		list: async (_ctx: DbReadCtx) => ({ items: [], hasMore: false }),
		upsert: async (_ctx: DbWriteCtx) => {},
		delete: async (_ctx: DbWriteCtx) => 0,
		findLatestResumeInfo: async (_ctx: DbReadCtx) => null,
		findLatestResumeInfoByWorkspaceId: async (_ctx: DbReadCtx) => null,
		...overrides,
	} as CodingAgentTurnRepository;
}
