import type { DbReadCtx, DbWriteCtx } from "../../../types/db-capability";
import type { IExecutionProcessRepositoryDef } from "../repository";

export function createMockExecutionProcessRepository(
	overrides: Partial<IExecutionProcessRepositoryDef> = {},
): IExecutionProcessRepositoryDef {
	return {
		get: async (_ctx: DbReadCtx) => null,
		list: async (_ctx: DbReadCtx) => ({ items: [], hasMore: false }),
		upsert: async (_ctx: DbWriteCtx) => {},
		delete: async (_ctx: DbWriteCtx) => 0,
		...overrides,
	} as IExecutionProcessRepositoryDef;
}
