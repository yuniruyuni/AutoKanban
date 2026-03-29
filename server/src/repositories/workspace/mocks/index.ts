import type { IWorkspaceRepository } from "../repository";

export function createMockWorkspaceRepository(
	overrides: Partial<IWorkspaceRepository> = {},
): IWorkspaceRepository {
	return {
		get: () => null,
		list: () => ({ items: [], hasMore: false }),
		findByWorktreePath: () => null,
		getMaxAttempt: () => 0,
		upsert: () => {},
		delete: () => 0,
		...overrides,
	} as IWorkspaceRepository;
}
