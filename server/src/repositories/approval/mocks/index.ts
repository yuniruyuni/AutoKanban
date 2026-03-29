import type { IApprovalRepository } from "../repository";

export function createMockApprovalRepository(
	overrides: Partial<IApprovalRepository> = {},
): IApprovalRepository {
	return {
		get: () => null,
		list: () => ({ items: [], hasMore: false }),
		upsert: () => {},
		delete: () => 0,
		...overrides,
	} as IApprovalRepository;
}
