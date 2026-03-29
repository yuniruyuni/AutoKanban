import type { IWorkspaceRepository } from "../repository";

export function createMockWorkspaceRepository(
	overrides: Partial<IWorkspaceRepository> = {},
): IWorkspaceRepository {
	return {
		get: async () => null,
		list: async () => ({ items: [], hasMore: false }),
		findByWorktreePath: async () => null,
		getMaxAttempt: async () => 0,
		upsert: async () => {},
		delete: async () => 0,
		...overrides,
	} as IWorkspaceRepository;
}
