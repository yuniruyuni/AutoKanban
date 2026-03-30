import type { WorkspaceRepoRepository } from "../repository";

export function createMockWorkspaceRepoRepository(
	overrides: Partial<WorkspaceRepoRepository> = {},
): WorkspaceRepoRepository {
	return {
		get: async () => null,
		list: async () => ({ items: [], hasMore: false }),
		listByWorkspace: async () => [],
		upsert: async () => {},
		delete: async () => 0,
		...overrides,
	} as WorkspaceRepoRepository;
}
