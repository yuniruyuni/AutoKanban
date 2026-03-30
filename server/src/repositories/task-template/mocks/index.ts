import type { ITaskTemplateRepositoryDef } from "../repository";

export function createMockTaskTemplateRepository(
	overrides: Partial<ITaskTemplateRepositoryDef> = {},
): ITaskTemplateRepositoryDef {
	return {
		get: async () => null,
		list: async () => ({ items: [], hasMore: false }),
		listAll: async () => [],
		upsert: async () => {},
		delete: async () => 0,
		...overrides,
	} as ITaskTemplateRepositoryDef;
}
