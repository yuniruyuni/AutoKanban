import type { IProjectRepository } from "../repository";

export function createMockProjectRepository(
	overrides: Partial<IProjectRepository> = {},
): IProjectRepository {
	return {
		get: () => null,
		list: () => ({ items: [], hasMore: false }),
		listAll: () => [],
		listAllWithStats: () => [],
		getWithStats: () => null,
		upsert: () => {},
		delete: () => 0,
		...overrides,
	} as IProjectRepository;
}
