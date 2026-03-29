import type { IApprovalRepository } from "../repository";

export function createMockApprovalRepository(
	overrides: Partial<IApprovalRepository> = {},
): IApprovalRepository {
	return {
		get: async () => null,
		list: async () => ({ items: [], hasMore: false }),
		upsert: async () => {},
		delete: async () => 0,
		...overrides,
	} as IApprovalRepository;
}
