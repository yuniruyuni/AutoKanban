import { AgentSetting } from "../../models/agent-setting";
import { usecase } from "../runner";

export const getAgentSetting = (agentId: string) =>
	usecase({
		read: async (ctx) => {
			const setting = await ctx.repos.agentSetting.get(
				AgentSetting.ById(agentId),
			);
			return { setting };
		},

		post: (ctx, { setting }) => {
			const driverInfo = ctx.repos.executor.getDriverInfo(agentId);
			return {
				command: setting?.command ?? null,
				defaultCommand: driverInfo?.defaultCommand ?? null,
			};
		},

		result: ({ command, defaultCommand }) => ({
			command,
			defaultCommand,
		}),
	});
