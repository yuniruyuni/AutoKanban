import type { DbReadCtx, DbWriteCtx } from "../../../types/db-capability";
import type { ExecutionProcessLogsRepository } from "../repository";

export function createMockExecutionProcessLogsRepository(
	overrides: Partial<ExecutionProcessLogsRepository> = {},
): ExecutionProcessLogsRepository {
	return {
		getLogs: async (_ctx: DbReadCtx) => null,
		upsertLogs: async (_ctx: DbWriteCtx) => {},
		appendLogs: async (_ctx: DbWriteCtx) => {},
		deleteLogs: async (_ctx: DbWriteCtx) => {},
		...overrides,
	} as ExecutionProcessLogsRepository;
}
