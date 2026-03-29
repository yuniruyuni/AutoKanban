import type { IWorkspaceRepoRepository } from "../repository";

export function createMockWorkspaceRepoRepository(
	overrides: Partial<IWorkspaceRepoRepository> = {},
): IWorkspaceRepoRepository {
	return {
		get: () => null,
		list: () => ({ items: [], hasMore: false }),
		listByWorkspace: () => [],
		upsert: () => {},
		delete: () => 0,
		...overrides,
	} as IWorkspaceRepoRepository;
}
