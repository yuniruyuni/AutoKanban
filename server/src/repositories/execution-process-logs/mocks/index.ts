import type { IExecutionProcessLogsRepository } from "../repository";

export function createMockExecutionProcessLogsRepository(
	overrides: Partial<IExecutionProcessLogsRepository> = {},
): IExecutionProcessLogsRepository {
	return {
		getLogs: async () => null,
		upsertLogs: async () => {},
		appendLogs: async () => {},
		deleteLogs: async () => {},
		...overrides,
	} as IExecutionProcessLogsRepository;
}
