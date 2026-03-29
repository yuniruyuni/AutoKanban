import type { IProjectRepository } from "../repository";

export function createMockProjectRepository(
	overrides: Partial<IProjectRepository> = {},
): IProjectRepository {
	return {
		get: async () => null,
		list: async () => ({ items: [], hasMore: false }),
		listAll: async () => [],
		listAllWithStats: async () => [],
		getWithStats: async () => null,
		upsert: async () => {},
		delete: async () => 0,
		...overrides,
	} as IProjectRepository;
}
