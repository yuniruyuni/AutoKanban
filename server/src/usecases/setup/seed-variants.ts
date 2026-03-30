import { Variant } from "../../models/variant";
import { usecase } from "../runner";

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

export const seedDefaultVariants = () =>
	usecase({
		read: async (ctx) => {
			const variants: Array<{
				executor: string;
				name: string;
				permissionMode: string;
				existing: Variant | null;
			}> = [];
			for (const def of DEFAULT_VARIANTS) {
				const existing = await ctx.repos.variant.get(
					Variant.ByExecutorAndName(def.executor, def.name),
				);
				variants.push({ ...def, existing });
			}
			return { variants };
		},

		write: async (ctx, { variants }) => {
			for (const { executor, name, permissionMode, existing } of variants) {
				if (!existing) {
					await ctx.repos.variant.upsert(
						Variant.create({ executor, name, permissionMode }),
					);
				}
			}

			// Migrate existing DEFAULT variant from bypassPermissions/plan to default mode
			const defaultVariant = variants.find(
				(v) => v.executor === "claude-code" && v.name === "DEFAULT",
			);
			if (
				defaultVariant?.existing &&
				defaultVariant.existing.permissionMode !== "default"
			) {
				await ctx.repos.variant.upsert({
					...defaultVariant.existing,
					permissionMode: "default",
					updatedAt: new Date(),
				});
			}

			return {};
		},
	});
