import { fail } from "../../models/common";
import { Tool } from "../../models/tool";
import { usecase } from "../runner";

export const deleteTool = (toolId: string) =>
	usecase({
		read: async (ctx) => {
			const tool = await ctx.repos.tool.get(Tool.ById(toolId));
			if (!tool) {
				return fail("NOT_FOUND", "Tool not found", { toolId });
			}
			return { tool };
		},

		write: async (ctx, { tool }) => {
			await ctx.repos.tool.delete(Tool.ById(tool.id));
			return { success: true };
		},
	});
