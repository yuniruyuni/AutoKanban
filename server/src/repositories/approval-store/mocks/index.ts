import type { ApprovalStoreRepository } from "../repository";

export function createMockApprovalStore(
	overrides: Partial<ApprovalStoreRepository> = {},
): ApprovalStoreRepository {
	return {
		createAndWait: async () => ({ status: "approved" as const, reason: null }),
		respond: () => true,
		hasPending: () => false,
		listPending: () => [],
		clear: () => {},
		...overrides,
	} as ApprovalStoreRepository;
}
