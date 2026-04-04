import { AgentSetting } from "../../models/agent-setting";
import { usecase } from "../runner";

export interface UpdateAgentSettingInput {
	agentId: string;
	command: string;
}

export const updateAgentSetting = (input: UpdateAgentSettingInput) =>
	usecase({
		process: () => {
			const setting = AgentSetting.create({
				agentId: input.agentId,
				command: input.command,
			});
			return { setting };
		},

		write: async (ctx, { setting }) => {
			await ctx.repos.agentSetting.upsert(setting);
			return { success: true as const };
		},
	});
