import type { ToolRepository } from "../repository";

export function createMockToolRepository(
	overrides: Partial<ToolRepository> = {},
): ToolRepository {
	return {
		get: async () => null,
		list: async () => ({ items: [], hasMore: false }),
		listAll: async () => [],
		upsert: async () => {},
		delete: async () => 0,
		executeCommand: async () => {},
		...overrides,
	} as ToolRepository;
}
