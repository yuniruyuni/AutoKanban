import type { DbReadCtx, DbWriteCtx } from "../../common";
import type { DevServerProcessRepository } from "../repository";

export function createMockDevServerProcessRepository(
	overrides: Partial<DevServerProcessRepository> = {},
): DevServerProcessRepository {
	return {
		get: async (_ctx: DbReadCtx) => null,
		list: async (_ctx: DbReadCtx) => ({ items: [], hasMore: false }),
		upsert: async (_ctx: DbWriteCtx) => {},
		delete: async (_ctx: DbWriteCtx) => 0,
		...overrides,
	} as DevServerProcessRepository;
}
