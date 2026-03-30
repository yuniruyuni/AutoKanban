import type { Context } from "../../../usecases/context";
import { appendExecutionLog } from "../../../usecases/execution/on-log-data";
import type { LogDataInfo } from "../client";

export async function handleLogData(
	ctx: Context,
	info: LogDataInfo,
): Promise<void> {
	await appendExecutionLog(info).run(ctx);
}
