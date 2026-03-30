import type { Context } from "../../../usecases/context";
import { handleProcessIdle as handleProcessIdleUsecase } from "../../../usecases/execution/on-process-idle";
import type { ProcessIdleInfo } from "../client";

export async function handleProcessIdle(
	ctx: Context,
	info: ProcessIdleInfo,
): Promise<void> {
	await handleProcessIdleUsecase(info).run(ctx);
}
