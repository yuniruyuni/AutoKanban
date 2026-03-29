import type { IWorkspaceRepoRepository } from "../repository";

export function createMockWorkspaceRepoRepository(
	overrides: Partial<IWorkspaceRepoRepository> = {},
): IWorkspaceRepoRepository {
	return {
		get: async () => null,
		list: async () => ({ items: [], hasMore: false }),
		listByWorkspace: async () => [],
		upsert: async () => {},
		delete: async () => 0,
		...overrides,
	} as IWorkspaceRepoRepository;
}
