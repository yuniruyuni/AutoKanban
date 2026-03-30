import type { DbReadCtx, DbWriteCtx } from "../../../types/db-capability";
import type { IApprovalRepositoryDef } from "../repository";

export function createMockApprovalRepository(
	overrides: Partial<IApprovalRepositoryDef> = {},
): IApprovalRepositoryDef {
	return {
		get: async (_ctx: DbReadCtx) => null,
		list: async (_ctx: DbReadCtx) => ({ items: [], hasMore: false }),
		upsert: async (_ctx: DbWriteCtx) => {},
		delete: async (_ctx: DbWriteCtx) => 0,
		...overrides,
	} as IApprovalRepositoryDef;
}
