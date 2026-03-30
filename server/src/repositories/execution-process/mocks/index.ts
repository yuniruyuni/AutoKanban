import type { DbReadCtx, DbWriteCtx } from "../../common";
import type { ExecutionProcessRepository } from "../repository";

export function createMockExecutionProcessRepository(
	overrides: Partial<ExecutionProcessRepository> = {},
): ExecutionProcessRepository {
	return {
		get: async (_ctx: DbReadCtx) => null,
		list: async (_ctx: DbReadCtx) => ({ items: [], hasMore: false }),
		upsert: async (_ctx: DbWriteCtx) => {},
		delete: async (_ctx: DbWriteCtx) => 0,
		...overrides,
	} as ExecutionProcessRepository;
}
