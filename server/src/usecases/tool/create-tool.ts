import type { Tool } from "../../models/tool";
import { usecase } from "../runner";

export const createTool = (tool: Tool) =>
	usecase({
		write: async (ctx) => {
			await ctx.repos.tool.upsert(tool);
			return tool;
		},
	});
