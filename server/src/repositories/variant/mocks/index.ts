import type { VariantRepository } from "../repository";

export function createMockVariantRepository(
	overrides: Partial<VariantRepository> = {},
): VariantRepository {
	return {
		get: async () => null,
		list: async () => ({ items: [], hasMore: false }),
		listByExecutor: async () => [],
		upsert: async () => {},
		delete: async () => 0,
		...overrides,
	} as VariantRepository;
}
