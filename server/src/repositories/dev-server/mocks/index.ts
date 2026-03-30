import type { DevServerRepository } from "../repository";

export function createMockDevServerRepository(
	overrides: Partial<DevServerRepository> = {},
): DevServerRepository {
	return {
		start: () => {},
		stop: () => false,
		get: () => undefined,
		...overrides,
	} as DevServerRepository;
}
