import type { IApprovalStore } from "../repository";

export function createMockApprovalStore(
	overrides: Partial<IApprovalStore> = {},
): IApprovalStore {
	return {
		createAndWait: async () => ({ status: "approved" as const, reason: null }),
		respond: () => true,
		getRespondedStatus: () => null,
		hasPending: () => false,
		listPending: () => [],
		clear: () => {},
		...overrides,
	} as IApprovalStore;
}
