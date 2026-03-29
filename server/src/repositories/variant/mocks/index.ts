import type { IVariantRepository } from "../repository";

export function createMockVariantRepository(
	overrides: Partial<IVariantRepository> = {},
): IVariantRepository {
	return {
		get: async () => null,
		list: async () => ({ items: [], hasMore: false }),
		listByExecutor: async () => [],
		upsert: async () => {},
		delete: async () => 0,
		...overrides,
	} as IVariantRepository;
}
