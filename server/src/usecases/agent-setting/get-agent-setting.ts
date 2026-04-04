import { AgentSetting } from "../../models/agent-setting";
import { usecase } from "../runner";

export interface GetAgentSettingInput {
	agentId: string;
}

export const getAgentSetting = (input: GetAgentSettingInput) =>
	usecase({
		read: async (ctx) => {
			const setting = await ctx.repos.agentSetting.get(
				AgentSetting.ById(input.agentId),
			);
			return { setting };
		},

		post: (ctx, { setting }) => {
			const driverInfo = ctx.repos.executor.getDriverInfo(input.agentId);
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
