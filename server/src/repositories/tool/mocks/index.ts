import type { IToolRepository } from "../repository";

export function createMockToolRepository(
	overrides: Partial<IToolRepository> = {},
): IToolRepository {
	return {
		get: async () => null,
		list: async () => ({ items: [], hasMore: false }),
		listAll: async () => [],
		upsert: async () => {},
		delete: async () => 0,
		executeCommand: async () => {},
		...overrides,
	} as IToolRepository;
}
