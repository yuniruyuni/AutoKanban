import type { TaskTemplateRepository } from "../repository";

export function createMockTaskTemplateRepository(
	overrides: Partial<TaskTemplateRepository> = {},
): TaskTemplateRepository {
	return {
		get: async () => null,
		list: async () => ({ items: [], hasMore: false }),
		listAll: async () => [],
		upsert: async () => {},
		delete: async () => 0,
		...overrides,
	} as TaskTemplateRepository;
}
