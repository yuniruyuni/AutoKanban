import type { Database } from "bun:sqlite";
import { Variant } from "../models/variant";
import { VariantRepository } from "../repositories/variant-repository";

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
] as const;

export function seedDefaultVariants(db: Database): void {
	const repo = new VariantRepository(db);

	for (const def of DEFAULT_VARIANTS) {
		const existing = repo.get(
			Variant.ByExecutorAndName(def.executor, def.name),
		);
		if (!existing) {
			repo.upsert(
				Variant.create({
					executor: def.executor,
					name: def.name,
					permissionMode: def.permissionMode,
				}),
			);
		}
	}

	// Migrate existing DEFAULT variant from bypassPermissions/plan to default mode
	const existingDefault = repo.get(
		Variant.ByExecutorAndName("claude-code", "DEFAULT"),
	);
	if (existingDefault && existingDefault.permissionMode !== "default") {
		repo.upsert({ ...existingDefault, permissionMode: "default", updatedAt: new Date() });
	}
}
