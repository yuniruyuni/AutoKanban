import type { CodingAgentProcessLogs } from "../../models/coding-agent-process";
import type { DbReadCtx, DbWriteCtx } from "../common";

export interface CodingAgentProcessLogsRepository {
	getLogs(
		ctx: DbReadCtx,
		codingAgentProcessId: string,
	): Promise<CodingAgentProcessLogs | null>;
	upsertLogs(ctx: DbWriteCtx, logs: CodingAgentProcessLogs): Promise<void>;
	appendLogs(
		ctx: DbWriteCtx,
		codingAgentProcessId: string,
		newLogs: string,
	): Promise<void>;
	deleteLogs(ctx: DbWriteCtx, codingAgentProcessId: string): Promise<void>;
}
