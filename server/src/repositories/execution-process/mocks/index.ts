import type { IExecutionProcessRepository } from "../repository";

export function createMockExecutionProcessRepository(
	overrides: Partial<IExecutionProcessRepository> = {},
): IExecutionProcessRepository {
	return {
		get: () => null,
		list: () => ({ items: [], hasMore: false }),
		upsert: () => {},
		delete: () => 0,
		...overrides,
	} as IExecutionProcessRepository;
}
