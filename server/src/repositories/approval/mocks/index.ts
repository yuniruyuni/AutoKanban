import type { DbReadCtx, DbWriteCtx } from "../../common";
import type { ApprovalRepository } from "../repository";

export function createMockApprovalRepository(
	overrides: Partial<ApprovalRepository> = {},
): ApprovalRepository {
	return {
		get: async (_ctx: DbReadCtx) => null,
		list: async (_ctx: DbReadCtx) => ({ items: [], hasMore: false }),
		upsert: async (_ctx: DbWriteCtx) => {},
		delete: async (_ctx: DbWriteCtx) => 0,
		...overrides,
	} as ApprovalRepository;
}
