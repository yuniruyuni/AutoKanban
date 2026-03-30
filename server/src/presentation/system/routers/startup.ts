import type { Context } from "../../../usecases/context";
import { recoverOrphanedProcesses } from "../../../usecases/setup/recovery";
import { seedDefaultVariants } from "../../../usecases/setup/seed-variants";
import { seedTaskTemplates } from "../../../usecases/setup/seed-templates";

export async function startup(ctx: Context): Promise<void> {
	const recoveredCount = await recoverOrphanedProcesses(ctx);
	if (recoveredCount > 0) {
		ctx.logger.info(
			`Recovered ${recoveredCount} orphaned process(es) from previous server session`,
		);
	}

	await seedDefaultVariants().run(ctx);
	await seedTaskTemplates().run(ctx);
}
