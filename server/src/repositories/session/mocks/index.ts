import type { DbReadCtx, DbWriteCtx } from "../../../types/db-capability";
import type { SessionRepository } from "../repository";

export function createMockSessionRepository(
	overrides: Partial<SessionRepository> = {},
): SessionRepository {
	return {
		get: async (_ctx: DbReadCtx) => null,
		list: async (_ctx: DbReadCtx) => ({ items: [], hasMore: false }),
		upsert: async (_ctx: DbWriteCtx) => {},
		delete: async (_ctx: DbWriteCtx) => 0,
		...overrides,
	} as SessionRepository;
}
