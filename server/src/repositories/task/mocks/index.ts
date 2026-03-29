import type { ITaskRepository } from "../repository";

export function createMockTaskRepository(
	overrides: Partial<ITaskRepository> = {},
): ITaskRepository {
	return {
		get: async () => null,
		list: async () => ({ items: [], hasMore: false }),
		upsert: async () => {},
		delete: async () => 0,
		count: async () => 0,
		...overrides,
	} as ITaskRepository;
}
