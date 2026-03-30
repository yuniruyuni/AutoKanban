import type { Context } from "../../../usecases/context";
import { updateSummary } from "../../../usecases/execution/on-summary";
import type { SummaryInfo } from "../client";

export async function handleSummary(
	ctx: Context,
	info: SummaryInfo,
): Promise<void> {
	await updateSummary(info).run(ctx);
}
