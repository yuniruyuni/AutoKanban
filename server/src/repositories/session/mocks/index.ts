import type { ISessionRepository } from "../repository";

export function createMockSessionRepository(
	overrides: Partial<ISessionRepository> = {},
): ISessionRepository {
	return {
		get: () => null,
		list: () => ({ items: [], hasMore: false }),
		upsert: () => {},
		delete: () => 0,
		...overrides,
	} as ISessionRepository;
}
