import type { IVariantRepositoryDef } from "../repository";

export function createMockVariantRepository(
	overrides: Partial<IVariantRepositoryDef> = {},
): IVariantRepositoryDef {
	return {
		get: async () => null,
		list: async () => ({ items: [], hasMore: false }),
		listByExecutor: async () => [],
		upsert: async () => {},
		delete: async () => 0,
		...overrides,
	} as IVariantRepositoryDef;
}
