import type { DbReadCtx, DbWriteCtx } from "../../../types/db-capability";
import type { IProjectRepositoryDef } from "../repository";

export function createMockProjectRepository(
	overrides: Partial<IProjectRepositoryDef> = {},
): IProjectRepositoryDef {
	return {
		get: async (_ctx: DbReadCtx) => null,
		list: async (_ctx: DbReadCtx) => ({ items: [], hasMore: false }),
		listAll: async (_ctx: DbReadCtx) => [],
		listAllWithStats: async (_ctx: DbReadCtx) => [],
		getWithStats: async (_ctx: DbReadCtx) => null,
		upsert: async (_ctx: DbWriteCtx) => {},
		delete: async (_ctx: DbWriteCtx) => 0,
		...overrides,
	} as IProjectRepositoryDef;
}
