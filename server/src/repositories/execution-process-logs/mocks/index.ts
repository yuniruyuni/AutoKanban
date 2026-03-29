import type { IExecutionProcessLogsRepository } from "../repository";

export function createMockExecutionProcessLogsRepository(
	overrides: Partial<IExecutionProcessLogsRepository> = {},
): IExecutionProcessLogsRepository {
	return {
		getLogs: () => null,
		upsertLogs: () => {},
		appendLogs: () => {},
		deleteLogs: () => {},
		...overrides,
	} as IExecutionProcessLogsRepository;
}
