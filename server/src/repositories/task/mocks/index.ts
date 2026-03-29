import type { ITaskRepository } from "../repository";

export function createMockTaskRepository(
	overrides: Partial<ITaskRepository> = {},
): ITaskRepository {
	return {
		get: () => null,
		list: () => ({ items: [], hasMore: false }),
		upsert: () => {},
		delete: () => 0,
		count: () => 0,
		...overrides,
	} as ITaskRepository;
}
