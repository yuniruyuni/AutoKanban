import type { IDevServerRepository } from "../repository";

export function createMockDevServerRepository(
	overrides: Partial<IDevServerRepository> = {},
): IDevServerRepository {
	return {
		start: () => {},
		stop: () => false,
		get: () => undefined,
		...overrides,
	} as IDevServerRepository;
}
