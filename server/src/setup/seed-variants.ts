import type { PgDatabase } from "../db/pg-client";
import { Variant } from "../models/variant";
import { PgVariantRepository } from "../repositories/variant";

const DEFAULT_VARIANTS = [
	{
		executor: "claude-code",
		name: "DEFAULT",
		permissionMode: "default",
	},
	{
		executor: "claude-code",
		name: "BYPASS",
		permissionMode: "bypassPermissions",
	},
	{
		executor: "claude-code",
		name: "PLAN",
		permissionMode: "plan",
	},
	{
		executor: "gemini-cli",
		name: "DEFAULT",
		permissionMode: "bypassPermissions",
	},
] as const;

export async function seedDefaultVariants(db: PgDatabase): Promise<void> {
	const repo = new PgVariantRepository(db);

	for (const def of DEFAULT_VARIANTS) {
		const existing = await repo.get(
			Variant.ByExecutorAndName(def.executor, def.name),
		);
		if (!existing) {
			await repo.upsert(
				Variant.create({
					executor: def.executor,
					name: def.name,
					permissionMode: def.permissionMode,
				}),
			);
		}
	}

	// Migrate existing DEFAULT variant from bypassPermissions/plan to default mode
	const existingDefault = await repo.get(
		Variant.ByExecutorAndName("claude-code", "DEFAULT"),
	);
	if (existingDefault && existingDefault.permissionMode !== "default") {
		await repo.upsert({
			...existingDefault,
			permissionMode: "default",
			updatedAt: new Date(),
		});
	}
}
