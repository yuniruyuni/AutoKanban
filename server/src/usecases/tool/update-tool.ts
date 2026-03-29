import { fail } from "../../models/common";
import { Tool } from "../../models/tool";
import { usecase } from "../runner";

export interface UpdateToolInput {
	toolId: string;
	name?: string;
	icon?: string;
	iconColor?: string;
	command?: string;
	sortOrder?: number;
}

export const updateTool = (input: UpdateToolInput) =>
	usecase({
		read: async (ctx) => {
			const tool = await ctx.repos.tool.get(Tool.ById(input.toolId));
			if (!tool) {
				return fail("NOT_FOUND", "Tool not found", { toolId: input.toolId });
			}
			return { tool };
		},

		process: (ctx, { tool }) => {
			const updatedTool = {
				...tool,
				name: input.name ?? tool.name,
				icon: input.icon ?? tool.icon,
				iconColor: input.iconColor ?? tool.iconColor,
				command: input.command ?? tool.command,
				sortOrder: input.sortOrder ?? tool.sortOrder,
				updatedAt: ctx.now,
			};
			return { tool: updatedTool };
		},

		write: async (ctx, { tool }) => {
			await ctx.repos.tool.upsert(tool);
			return tool;
		},
	});
