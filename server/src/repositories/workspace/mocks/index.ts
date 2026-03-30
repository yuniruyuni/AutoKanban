import type { DbReadCtx, DbWriteCtx } from "../../../types/db-capability";
import type { WorkspaceRepository } from "../repository";

export function createMockWorkspaceRepository(
	overrides: Partial<WorkspaceRepository> = {},
): WorkspaceRepository {
	return {
		get: async (_ctx: DbReadCtx) => null,
		list: async (_ctx: DbReadCtx) => ({ items: [], hasMore: false }),
		findByWorktreePath: async (_ctx: DbReadCtx) => null,
		getMaxAttempt: async (_ctx: DbReadCtx) => 0,
		upsert: async (_ctx: DbWriteCtx) => {},
		delete: async (_ctx: DbWriteCtx) => 0,
		...overrides,
	} as WorkspaceRepository;
}
