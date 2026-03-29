import type { ITaskTemplateRepository } from "../repository";

export function createMockTaskTemplateRepository(
	overrides: Partial<ITaskTemplateRepository> = {},
): ITaskTemplateRepository {
	return {
		get: () => null,
		list: () => ({ items: [], hasMore: false }),
		listAll: () => [],
		upsert: () => {},
		delete: () => 0,
		...overrides,
	} as ITaskTemplateRepository;
}
