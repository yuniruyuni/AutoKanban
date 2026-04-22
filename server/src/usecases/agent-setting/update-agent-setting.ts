import { AgentSetting } from "../../models/agent-setting";
import { usecase } from "../runner";

export const updateAgentSetting = (agentId: string, command: string) =>
	usecase({
		process: () => {
			const setting = AgentSetting.create({
				agentId,
				command,
			});
			return { setting };
		},

		write: async (ctx, { setting }) => {
			await ctx.repos.agentSetting.upsert(setting);
			return { success: true as const };
		},
	});
