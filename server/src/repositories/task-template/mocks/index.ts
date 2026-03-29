import type { ITaskTemplateRepository } from "../repository";

export function createMockTaskTemplateRepository(
	overrides: Partial<ITaskTemplateRepository> = {},
): ITaskTemplateRepository {
	return {
		get: async () => null,
		list: async () => ({ items: [], hasMore: false }),
		listAll: async () => [],
		upsert: async () => {},
		delete: async () => 0,
		...overrides,
	} as ITaskTemplateRepository;
}
