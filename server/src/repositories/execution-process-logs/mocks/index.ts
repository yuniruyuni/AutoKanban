import type { DbReadCtx, DbWriteCtx } from "../../../types/db-capability";
import type { IExecutionProcessLogsRepositoryDef } from "../repository";

export function createMockExecutionProcessLogsRepository(
	overrides: Partial<IExecutionProcessLogsRepositoryDef> = {},
): IExecutionProcessLogsRepositoryDef {
	return {
		getLogs: async (_ctx: DbReadCtx) => null,
		upsertLogs: async (_ctx: DbWriteCtx) => {},
		appendLogs: async (_ctx: DbWriteCtx) => {},
		deleteLogs: async (_ctx: DbWriteCtx) => {},
		...overrides,
	} as IExecutionProcessLogsRepositoryDef;
}
