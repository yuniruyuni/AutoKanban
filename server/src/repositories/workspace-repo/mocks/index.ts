import type { IWorkspaceRepoRepositoryDef } from "../repository";

export function createMockWorkspaceRepoRepository(
	overrides: Partial<IWorkspaceRepoRepositoryDef> = {},
): IWorkspaceRepoRepositoryDef {
	return {
		get: async () => null,
		list: async () => ({ items: [], hasMore: false }),
		listByWorkspace: async () => [],
		upsert: async () => {},
		delete: async () => 0,
		...overrides,
	} as IWorkspaceRepoRepositoryDef;
}
