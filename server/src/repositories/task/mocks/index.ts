import type { DbReadCtx, DbWriteCtx } from "../../common";
import type { TaskRepository } from "../repository";

export function createMockTaskRepository(
	overrides: Partial<TaskRepository> = {},
): TaskRepository {
	return {
		get: async (_ctx: DbReadCtx) => null,
		list: async (_ctx: DbReadCtx) => ({ items: [], hasMore: false }),
		upsert: async (_ctx: DbWriteCtx) => {},
		delete: async (_ctx: DbWriteCtx) => 0,
		count: async (_ctx: DbReadCtx) => 0,
		...overrides,
	} as TaskRepository;
}
