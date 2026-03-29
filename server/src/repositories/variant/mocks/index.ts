import type { IVariantRepository } from "../repository";

export function createMockVariantRepository(
	overrides: Partial<IVariantRepository> = {},
): IVariantRepository {
	return {
		get: () => null,
		list: () => ({ items: [], hasMore: false }),
		listByExecutor: () => [],
		upsert: () => {},
		delete: () => 0,
		...overrides,
	} as IVariantRepository;
}
