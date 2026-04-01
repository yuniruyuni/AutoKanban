import type { DbReadCtx, DbWriteCtx } from "../../common";
import type { WorkspaceScriptProcessLogsRepository } from "../repository";

export function createMockWorkspaceScriptProcessLogsRepository(
	overrides: Partial<WorkspaceScriptProcessLogsRepository> = {},
): WorkspaceScriptProcessLogsRepository {
	return {
		getLogs: async (_ctx: DbReadCtx) => null,
		upsertLogs: async (_ctx: DbWriteCtx) => {},
		appendLogs: async (_ctx: DbWriteCtx) => {},
		deleteLogs: async (_ctx: DbWriteCtx) => {},
		...overrides,
	} as WorkspaceScriptProcessLogsRepository;
}
