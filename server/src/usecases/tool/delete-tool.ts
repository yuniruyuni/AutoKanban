import { fail } from "../../models/common";
import { Tool } from "../../models/tool";
import { usecase } from "../runner";

export interface DeleteToolInput {
	toolId: string;
}

export const deleteTool = (input: DeleteToolInput) =>
	usecase({
		read: async (ctx) => {
			const tool = await ctx.repos.tool.get(Tool.ById(input.toolId));
			if (!tool) {
				return fail("NOT_FOUND", "Tool not found", { toolId: input.toolId });
			}
			return { tool };
		},

		write: async (ctx, { tool }) => {
			await ctx.repos.tool.delete(Tool.ById(tool.id));
			return { success: true };
		},
	});
