import type { DbReadCtx, DbWriteCtx } from "../../common";
import type { DevServerProcessLogsRepository } from "../repository";

export function createMockDevServerProcessLogsRepository(
	overrides: Partial<DevServerProcessLogsRepository> = {},
): DevServerProcessLogsRepository {
	return {
		getLogs: async (_ctx: DbReadCtx) => null,
		upsertLogs: async (_ctx: DbWriteCtx) => {},
		appendLogs: async (_ctx: DbWriteCtx) => {},
		deleteLogs: async (_ctx: DbWriteCtx) => {},
		...overrides,
	} as DevServerProcessLogsRepository;
}
