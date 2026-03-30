import type { Context } from "../../../usecases/context";
import type { ProcessIdleInfo } from "../client";
import { handleProcessIdle as handleProcessIdleUsecase } from "../../../usecases/execution/on-process-idle";

export async function handleProcessIdle(
	ctx: Context,
	info: ProcessIdleInfo,
): Promise<void> {
	await handleProcessIdleUsecase(info).run(ctx);
}
