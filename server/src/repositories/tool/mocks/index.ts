import type { IToolRepositoryDef } from "../repository";

export function createMockToolRepository(
	overrides: Partial<IToolRepositoryDef> = {},
): IToolRepositoryDef {
	return {
		get: async () => null,
		list: async () => ({ items: [], hasMore: false }),
		listAll: async () => [],
		upsert: async () => {},
		delete: async () => 0,
		executeCommand: async () => {},
		...overrides,
	} as IToolRepositoryDef;
}
