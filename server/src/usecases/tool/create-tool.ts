import { Tool } from "../../models/tool";
import { usecase } from "../runner";

export interface CreateToolInput {
	name: string;
	icon: string;
	iconColor?: string;
	command: string;
	sortOrder?: number;
}

export const createTool = (input: CreateToolInput) =>
	usecase({
		process: () => {
			const tool = Tool.create({
				name: input.name,
				icon: input.icon,
				iconColor: input.iconColor,
				command: input.command,
				sortOrder: input.sortOrder,
			});
			return { tool };
		},

		write: async (ctx, { tool }) => {
			await ctx.repos.tool.upsert(tool);
			return tool;
		},
	});
