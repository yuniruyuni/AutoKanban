import type { DbReadCtx, DbWriteCtx } from "../../common";
import type { WorkspaceScriptProcessRepository } from "../repository";

export function createMockWorkspaceScriptProcessRepository(
	overrides: Partial<WorkspaceScriptProcessRepository> = {},
): WorkspaceScriptProcessRepository {
	return {
		get: async (_ctx: DbReadCtx) => null,
		list: async (_ctx: DbReadCtx) => ({ items: [], hasMore: false }),
		upsert: async (_ctx: DbWriteCtx) => {},
		delete: async (_ctx: DbWriteCtx) => 0,
		...overrides,
	} as WorkspaceScriptProcessRepository;
}
