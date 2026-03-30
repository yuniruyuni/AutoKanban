import type { Context } from "../../../usecases/context";
import { recoverOrphanedProcesses } from "../../../usecases/setup/recovery";
import { seedDefaultVariants } from "../../../usecases/setup/seed-variants";
import { seedTaskTemplates } from "../../../usecases/setup/seed-templates";

export async function startup(ctx: Context): Promise<void> {
	const log = ctx.logger.child("Startup");

	log.info("Recovering orphaned processes...");
	const recoveredCount = await recoverOrphanedProcesses(ctx);
	if (recoveredCount > 0) {
		log.info(`Recovered ${recoveredCount} orphaned process(es)`);
	}

	log.info("Seeding default variants...");
	await seedDefaultVariants().run(ctx);

	log.info("Seeding task templates...");
	await seedTaskTemplates().run(ctx);

	log.info("Startup complete");
}
