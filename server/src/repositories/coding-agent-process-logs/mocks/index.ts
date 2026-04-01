import type { DbReadCtx, DbWriteCtx } from "../../common";
import type { CodingAgentProcessLogsRepository } from "../repository";

export function createMockCodingAgentProcessLogsRepository(
	overrides: Partial<CodingAgentProcessLogsRepository> = {},
): CodingAgentProcessLogsRepository {
	return {
		getLogs: async (_ctx: DbReadCtx) => null,
		upsertLogs: async (_ctx: DbWriteCtx) => {},
		appendLogs: async (_ctx: DbWriteCtx) => {},
		deleteLogs: async (_ctx: DbWriteCtx) => {},
		...overrides,
	} as CodingAgentProcessLogsRepository;
}
