import { fail } from "../../models/common";
import { Tool } from "../../models/tool";
import { usecase } from "../runner";

export const updateTool = (toolId: string, fields: Tool.UpdateFields) =>
	usecase({
		read: async (ctx) => {
			const tool = await ctx.repos.tool.get(Tool.ById(toolId));
			if (!tool) {
				return fail("NOT_FOUND", "Tool not found", { toolId });
			}
			return { tool };
		},

		process: (ctx, { tool }) => {
			const updated = Tool.applyUpdate(tool, fields, ctx.now);
			return { tool: updated };
		},

		write: async (ctx, { tool }) => {
			await ctx.repos.tool.upsert(tool);
			return tool;
		},
	});
