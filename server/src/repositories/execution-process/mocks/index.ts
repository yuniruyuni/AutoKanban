import type { IExecutionProcessRepository } from "../repository";

export function createMockExecutionProcessRepository(
	overrides: Partial<IExecutionProcessRepository> = {},
): IExecutionProcessRepository {
	return {
		get: async () => null,
		list: async () => ({ items: [], hasMore: false }),
		upsert: async () => {},
		delete: async () => 0,
		...overrides,
	} as IExecutionProcessRepository;
}
