import type { DevServerProcessLogs } from "../../models/dev-server-process";
import type { DbReadCtx, DbWriteCtx } from "../common";

export interface DevServerProcessLogsRepository {
	getLogs(
		ctx: DbReadCtx,
		devServerProcessId: string,
	): Promise<DevServerProcessLogs | null>;
	upsertLogs(ctx: DbWriteCtx, logs: DevServerProcessLogs): Promise<void>;
	appendLogs(
		ctx: DbWriteCtx,
		devServerProcessId: string,
		newLogs: string,
	): Promise<void>;
	deleteLogs(ctx: DbWriteCtx, devServerProcessId: string): Promise<void>;
}
