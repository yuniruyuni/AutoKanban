import type { ExecutorRepository } from "../repository";

export function createMockExecutorRepository(
	overrides: Partial<ExecutorRepository> = {},
): ExecutorRepository {
	return {
		start: async () => ({
			id: "mock-id",
			sessionId: "mock-session",
			runReason: "codingagent" as const,
			startedAt: new Date(),
		}),
		startProtocol: async () => ({
			id: "mock-id",
			sessionId: "mock-session",
			runReason: "codingagent" as const,
			startedAt: new Date(),
		}),
		stop: async () => false,
		sendMessage: async () => false,
		sendPermissionResponse: async () => false,
		startProtocolAndWait: async () => ({ exitCode: 0 }),
		get: () => undefined,
		getBySession: () => [],
		getStdout: () => null,
		getStderr: () => null,
		...overrides,
	} as ExecutorRepository;
}
