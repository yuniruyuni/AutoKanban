import type { ISessionRepository } from "../repository";

export function createMockSessionRepository(
	overrides: Partial<ISessionRepository> = {},
): ISessionRepository {
	return {
		get: async () => null,
		list: async () => ({ items: [], hasMore: false }),
		upsert: async () => {},
		delete: async () => 0,
		...overrides,
	} as ISessionRepository;
}
