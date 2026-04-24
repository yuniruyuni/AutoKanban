import { Variant } from "../../models/variant";
import { usecase } from "../runner";

export const seedDefaultVariants = () =>
	usecase({
		read: async (ctx) => {
			const definitions = ctx.repos.agent
				.list()
				.flatMap((agent) => agent.defaultVariants);
			const variants: Array<{
				executor: string;
				name: string;
				permissionMode: string;
				model?: string | null;
				appendPrompt?: string | null;
				existing: Variant | null;
			}> = [];
			for (const def of definitions) {
				const existing = await ctx.repos.variant.get(
					Variant.ByExecutorAndName(def.executor, def.name),
				);
				variants.push({ ...def, existing });
			}
			return { variants };
		},

		write: async (ctx, { variants }) => {
			for (const {
				executor,
				name,
				permissionMode,
				model,
				appendPrompt,
				existing,
			} of variants) {
				if (!existing) {
					await ctx.repos.variant.upsert(
						Variant.create({
							executor,
							name,
							permissionMode,
							model,
							appendPrompt,
						}),
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
