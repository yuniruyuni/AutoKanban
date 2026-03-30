import type { DbReadCtx, DbWriteCtx } from "../../../types/db-capability";
import type { IWorkspaceRepositoryDef } from "../repository";

export function createMockWorkspaceRepository(
	overrides: Partial<IWorkspaceRepositoryDef> = {},
): IWorkspaceRepositoryDef {
	return {
		get: async (_ctx: DbReadCtx) => null,
		list: async (_ctx: DbReadCtx) => ({ items: [], hasMore: false }),
		findByWorktreePath: async (_ctx: DbReadCtx) => null,
		getMaxAttempt: async (_ctx: DbReadCtx) => 0,
		upsert: async (_ctx: DbWriteCtx) => {},
		delete: async (_ctx: DbWriteCtx) => 0,
		...overrides,
	} as IWorkspaceRepositoryDef;
}
