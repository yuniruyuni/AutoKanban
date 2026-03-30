import type { Context } from "../../../usecases/context";
import { updateSessionInfo } from "../../../usecases/execution/on-session-info";
import type { SessionInfoUpdate } from "../client";

export async function handleSessionInfo(
	ctx: Context,
	info: SessionInfoUpdate,
): Promise<void> {
	await updateSessionInfo(info).run(ctx);
}
