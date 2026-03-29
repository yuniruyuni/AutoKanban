import type { IToolRepository } from "../repository";

export function createMockToolRepository(
	overrides: Partial<IToolRepository> = {},
): IToolRepository {
	return {
		get: () => null,
		list: () => ({ items: [], hasMore: false }),
		listAll: () => [],
		upsert: () => {},
		delete: () => 0,
		executeCommand: () => {},
		...overrides,
	} as IToolRepository;
}
